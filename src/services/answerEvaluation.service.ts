import { logger } from '../config/logger';

/**
 * Server-side answer evaluation.
 *
 * SECURITY: this module is the single source of truth for whether a user's
 * submission to a slide or checkpoint is correct. The client must never
 * provide an `isCorrect` / `completed` boolean — those are computed here.
 */

export interface SlideEvaluation {
    isCorrect: boolean;
    expected?: unknown;
    note?: string;
}

/**
 * Normalize Arabic text for FILL_BLANK comparison.
 * Strips tashkeel, normalizes alef/yeh/teh-marbuta variants, removes tatweel,
 * collapses whitespace, lowercases. Exported for unit tests.
 */
export const normalizeArabic = (text: string): string => {
    if (typeof text !== 'string') return '';

    return text
        .replace(/[\u064B-\u0652]/g, '')       // tashkeel
        .replace(/\u0640/g, '')                 // tatweel
        .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // alef variants
        .replace(/[\u0649\u0626]/g, '\u064A')   // yeh variants
        .replace(/\u0629/g, '\u0647')           // teh marbuta
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
};

// ---------------------------------------------------------------------------
// Slide evaluation
// ---------------------------------------------------------------------------

interface EvaluateSlideInput {
    slideType: 'INFO' | 'QUIZ' | 'DRAG_DROP' | 'TRUE_FALSE' | 'FILL_BLANK';
    correctIndex: number | null;
    correctAnswer: boolean | null;
    acceptedAnswersJson: unknown;
    itemsJson: unknown;
}

export const evaluateSlideAnswer = (
    slide: EvaluateSlideInput,
    submittedAnswer: unknown
): SlideEvaluation => {
    try {
        switch (slide.slideType) {
            case 'INFO':
                return { isCorrect: true };

            case 'QUIZ': {
                if (slide.correctIndex === null || slide.correctIndex === undefined) {
                    logger.warn({ slideType: slide.slideType }, 'answerEvaluation: QUIZ slide missing correctIndex');
                    return { isCorrect: false, note: 'missing correctIndex' };
                }

                const answer = submittedAnswer as { index?: unknown } | null;
                const submittedIndex = typeof answer?.index === 'number' ? answer.index : null;
                if (submittedIndex === null) {
                    return { isCorrect: false, note: 'invalid answer shape for QUIZ' };
                }

                return {
                    isCorrect: submittedIndex === slide.correctIndex,
                    expected: slide.correctIndex,
                };
            }

            case 'TRUE_FALSE': {
                if (slide.correctAnswer === null || slide.correctAnswer === undefined) {
                    logger.warn({ slideType: slide.slideType }, 'answerEvaluation: TRUE_FALSE slide missing correctAnswer');
                    return { isCorrect: false, note: 'missing correctAnswer' };
                }

                const answer = submittedAnswer as { value?: unknown } | null;
                const submittedValue = typeof answer?.value === 'boolean' ? answer.value : null;
                if (submittedValue === null) {
                    return { isCorrect: false, note: 'invalid answer shape for TRUE_FALSE' };
                }

                return {
                    isCorrect: submittedValue === slide.correctAnswer,
                    expected: slide.correctAnswer,
                };
            }

            case 'FILL_BLANK': {
                const accepted = Array.isArray(slide.acceptedAnswersJson)
                    ? (slide.acceptedAnswersJson as string[])
                    : [];

                if (accepted.length === 0) {
                    logger.warn({ slideType: slide.slideType }, 'answerEvaluation: FILL_BLANK slide has no accepted answers');
                    return { isCorrect: false, note: 'no accepted answers configured' };
                }

                const answer = submittedAnswer as { text?: unknown } | null;
                const submittedText = typeof answer?.text === 'string' ? answer.text : null;
                if (submittedText === null || submittedText.trim() === '') {
                    return { isCorrect: false, note: 'empty submission' };
                }

                const normalizedSubmitted = normalizeArabic(submittedText);
                const normalizedAccepted = accepted.map(normalizeArabic);
                return {
                    isCorrect: normalizedAccepted.includes(normalizedSubmitted),
                    expected: accepted,
                };
            }

            case 'DRAG_DROP': {
                const expectedItems = Array.isArray(slide.itemsJson)
                    ? (slide.itemsJson as Array<{ label: string; correctZone: string }>)
                    : [];

                if (expectedItems.length === 0) {
                    logger.warn({ slideType: slide.slideType }, 'answerEvaluation: DRAG_DROP slide has no items configured');
                    return { isCorrect: false, note: 'no items configured' };
                }

                const answer = submittedAnswer as
                    | { items?: Array<{ label?: unknown; correctZone?: unknown }> }
                    | null;

                if (!Array.isArray(answer?.items)) {
                    return { isCorrect: false, note: 'invalid answer shape for DRAG_DROP' };
                }
                if (answer.items.length !== expectedItems.length) {
                    return { isCorrect: false, expected: expectedItems, note: 'item count mismatch' };
                }

                const submittedMap = new Map<string, string>();
                for (const item of answer.items) {
                    if (typeof item.label !== 'string' || typeof item.correctZone !== 'string') {
                        return { isCorrect: false, note: 'malformed DRAG_DROP item' };
                    }
                    submittedMap.set(item.label, item.correctZone);
                }

                for (const expected of expectedItems) {
                    if (submittedMap.get(expected.label) !== expected.correctZone) {
                        return { isCorrect: false, expected: expectedItems };
                    }
                }

                return { isCorrect: true };
            }

            default: {
                logger.warn({ slideType: slide.slideType }, 'answerEvaluation: unknown slide type');
                return { isCorrect: false, note: 'unknown slide type' };
            }
        }
    } catch (err) {
        logger.error({ err, slideType: slide.slideType }, 'answerEvaluation: unexpected error');
        return { isCorrect: false, note: 'evaluation error' };
    }
};

// ---------------------------------------------------------------------------
// Checkpoint evaluation
// ---------------------------------------------------------------------------

/**
 * Checkpoints are self-reflection mini-quests — no objective correct answer.
 * Submitting a non-empty selfReflectionAnswer completes the checkpoint.
 *
 * The client no longer sends `completed: true` — that flag was spoofable.
 */
export const evaluateCheckpointSubmission = (
    submission: { selfReflectionAnswer?: string } | undefined | null
): { isComplete: boolean; note?: string } => {
    const text = submission?.selfReflectionAnswer;
    if (typeof text !== 'string' || text.trim() === '') {
        return { isComplete: false, note: 'empty submission' };
    }
    return { isComplete: true };
};

/**
 * Evaluate a warm-up riddle answer.
 * Warm-ups are single-answer tasks: `warmUpJson.answerAr` is the target.
 * Uses the same Arabic normalization as FILL_BLANK slides.
 */
export const evaluateWarmUpAnswer = (
    warmUpJson: unknown,
    submittedAnswer: unknown
): { isCorrect: boolean; expected?: string } => {
    const warmUp = warmUpJson as { answerAr?: string } | null;
    const expectedRaw = warmUp?.answerAr;
    if (typeof expectedRaw !== 'string' || expectedRaw.trim() === '') {
        // No answer configured → cannot grade. Fail closed.
        return { isCorrect: false, expected: undefined };
    }
    if (typeof submittedAnswer !== 'string' || submittedAnswer.trim() === '') {
        return { isCorrect: false, expected: expectedRaw };
    }

    const normalizedExpected = normalizeArabic(expectedRaw);
    const normalizedSubmitted = normalizeArabic(submittedAnswer);
    return {
        isCorrect: normalizedSubmitted === normalizedExpected,
        expected: expectedRaw,
    };
};