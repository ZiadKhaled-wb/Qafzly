import {
    normalizeArabic,
    evaluateSlideAnswer,
    evaluateCheckpointSubmission,
} from '../answerEvaluation.service';

describe('Answer Evaluation Service', () => {
    // =========================================================================
    // normalizeArabic
    // =========================================================================
    describe('normalizeArabic', () => {
        it('should strip tashkeel (diacritics)', () => {
            expect(normalizeArabic('مَدْرَسَة')).toBe(normalizeArabic('مدرسة'));
        });

        it('should normalize alef variants (أ إ آ → ا)', () => {
            expect(normalizeArabic('أحمد')).toBe(normalizeArabic('احمد'));
            expect(normalizeArabic('إسلام')).toBe(normalizeArabic('اسلام'));
            expect(normalizeArabic('آدم')).toBe(normalizeArabic('ادم'));
        });

        it('should normalize yeh variants (ى ئ → ي)', () => {
            expect(normalizeArabic('مصطفى')).toBe(normalizeArabic('مصطفي'));
            expect(normalizeArabic('مائدة')).toBe(normalizeArabic('مايده'));
        });

        it('should normalize teh marbuta (ة → ه)', () => {
            expect(normalizeArabic('مدرسة')).toBe(normalizeArabic('مدرسه'));
        });

        it('should remove tatweel (kashida)', () => {
            expect(normalizeArabic('مـــدرسة')).toBe(normalizeArabic('مدرسة'));
        });

        it('should collapse whitespace and trim', () => {
            expect(normalizeArabic('  test   text  ')).toBe('test text');
        });

        it('should handle non-string input gracefully', () => {
            expect(normalizeArabic(null as any)).toBe('');
            expect(normalizeArabic(undefined as any)).toBe('');
            expect(normalizeArabic(42 as any)).toBe('');
        });
    });

    // =========================================================================
    // evaluateSlideAnswer — INFO
    // =========================================================================
    describe('evaluateSlideAnswer — INFO', () => {
        it('should always be correct (no answer required)', () => {
            const result = evaluateSlideAnswer(
                {
                    slideType: 'INFO',
                    correctIndex: null,
                    correctAnswer: null,
                    acceptedAnswersJson: null,
                    itemsJson: null,
                },
                undefined
            );
            expect(result.isCorrect).toBe(true);
        });
    });

    // =========================================================================
    // evaluateSlideAnswer — QUIZ
    // =========================================================================
    describe('evaluateSlideAnswer — QUIZ', () => {
        const baseQuiz = {
            slideType: 'QUIZ' as const,
            correctIndex: 1,
            correctAnswer: null,
            acceptedAnswersJson: null,
            itemsJson: null,
        };

        it('should be correct when submitted index matches', () => {
            expect(evaluateSlideAnswer(baseQuiz, { index: 1 }).isCorrect).toBe(true);
        });

        it('should be incorrect when submitted index differs', () => {
            expect(evaluateSlideAnswer(baseQuiz, { index: 0 }).isCorrect).toBe(false);
        });

        it('should be incorrect for missing index', () => {
            expect(evaluateSlideAnswer(baseQuiz, {}).isCorrect).toBe(false);
            expect(evaluateSlideAnswer(baseQuiz, undefined).isCorrect).toBe(false);
        });

        it('should be incorrect for non-number index', () => {
            expect(evaluateSlideAnswer(baseQuiz, { index: '1' }).isCorrect).toBe(false);
        });

        it('should be incorrect when slide has no correctIndex configured', () => {
            const malformed = { ...baseQuiz, correctIndex: null };
            expect(evaluateSlideAnswer(malformed, { index: 0 }).isCorrect).toBe(false);
        });
    });

    // =========================================================================
    // evaluateSlideAnswer — TRUE_FALSE
    // =========================================================================
    describe('evaluateSlideAnswer — TRUE_FALSE', () => {
        const baseTF = {
            slideType: 'TRUE_FALSE' as const,
            correctIndex: null,
            correctAnswer: true,
            acceptedAnswersJson: null,
            itemsJson: null,
        };

        it('should be correct when boolean matches', () => {
            expect(evaluateSlideAnswer(baseTF, { value: true }).isCorrect).toBe(true);
            expect(
                evaluateSlideAnswer({ ...baseTF, correctAnswer: false }, { value: false })
                    .isCorrect
            ).toBe(true);
        });

        it('should be incorrect when boolean differs', () => {
            expect(evaluateSlideAnswer(baseTF, { value: false }).isCorrect).toBe(false);
        });

        it('should be incorrect for non-boolean value', () => {
            expect(evaluateSlideAnswer(baseTF, { value: 'true' }).isCorrect).toBe(false);
        });
    });

    // =========================================================================
    // evaluateSlideAnswer — FILL_BLANK
    // =========================================================================
    describe('evaluateSlideAnswer — FILL_BLANK', () => {
        const baseFill = {
            slideType: 'FILL_BLANK' as const,
            correctIndex: null,
            correctAnswer: null,
            acceptedAnswersJson: ['الطوبة', 'طوبه'],
            itemsJson: null,
        };

        it('should be correct for exact match', () => {
            expect(evaluateSlideAnswer(baseFill, { text: 'الطوبة' }).isCorrect).toBe(true);
        });

        it('should be correct ignoring diacritics', () => {
            expect(evaluateSlideAnswer(baseFill, { text: 'الطّوبة' }).isCorrect).toBe(true);
        });

        it('should be correct ignoring alef variants', () => {
            const slide = { ...baseFill, acceptedAnswersJson: ['اسلام'] };
            expect(evaluateSlideAnswer(slide, { text: 'إسلام' }).isCorrect).toBe(true);
        });

        it('should be correct ignoring teh marbuta / heh', () => {
            const slide = { ...baseFill, acceptedAnswersJson: ['مدرسة'] };
            expect(evaluateSlideAnswer(slide, { text: 'مدرسه' }).isCorrect).toBe(true);
        });

        it('should be incorrect for wrong text', () => {
            expect(evaluateSlideAnswer(baseFill, { text: 'خطأ' }).isCorrect).toBe(false);
        });

        it('should be incorrect for empty text', () => {
            expect(evaluateSlideAnswer(baseFill, { text: '' }).isCorrect).toBe(false);
            expect(evaluateSlideAnswer(baseFill, { text: '   ' }).isCorrect).toBe(false);
        });

        it('should be incorrect when no accepted answers configured', () => {
            const slide = { ...baseFill, acceptedAnswersJson: [] };
            expect(evaluateSlideAnswer(slide, { text: 'الطوبة' }).isCorrect).toBe(false);
        });
    });

    // =========================================================================
    // evaluateSlideAnswer — DRAG_DROP
    // =========================================================================
    describe('evaluateSlideAnswer — DRAG_DROP', () => {
        const baseDrag = {
            slideType: 'DRAG_DROP' as const,
            correctIndex: null,
            correctAnswer: null,
            acceptedAnswersJson: null,
            itemsJson: [
                { label: 'ضغطة الزرار', correctZone: 'input' },
                { label: 'قرار العمدة', correctZone: 'process' },
                { label: 'قفز الشخصية', correctZone: 'output' },
            ],
        };

        it('should be correct when all items match (order-insensitive)', () => {
            expect(
                evaluateSlideAnswer(baseDrag, {
                    items: [
                        { label: 'قفز الشخصية', correctZone: 'output' },
                        { label: 'ضغطة الزرار', correctZone: 'input' },
                        { label: 'قرار العمدة', correctZone: 'process' },
                    ],
                }).isCorrect
            ).toBe(true);
        });

        it('should be incorrect when any item is in wrong zone', () => {
            expect(
                evaluateSlideAnswer(baseDrag, {
                    items: [
                        { label: 'ضغطة الزرار', correctZone: 'output' },
                        { label: 'قرار العمدة', correctZone: 'process' },
                        { label: 'قفز الشخصية', correctZone: 'output' },
                    ],
                }).isCorrect
            ).toBe(false);
        });

        it('should be incorrect when item count differs', () => {
            expect(
                evaluateSlideAnswer(baseDrag, {
                    items: [{ label: 'ضغطة الزرار', correctZone: 'input' }],
                }).isCorrect
            ).toBe(false);
        });

        it('should be incorrect for malformed items', () => {
            expect(evaluateSlideAnswer(baseDrag, { items: 'not-an-array' }).isCorrect).toBe(false);
            expect(
                evaluateSlideAnswer(baseDrag, {
                    items: [{ label: 42, correctZone: 'x' }],
                }).isCorrect
            ).toBe(false);
        });

        it('should be incorrect when no items configured', () => {
            const slide = { ...baseDrag, itemsJson: [] };
            expect(evaluateSlideAnswer(slide, { items: [] }).isCorrect).toBe(false);
        });
    });

    // =========================================================================
    // evaluateCheckpointSubmission
    // =========================================================================
    describe('evaluateCheckpointSubmission', () => {
        it('should return isComplete: true for a non-empty answer', () => {
            expect(
                evaluateCheckpointSubmission({ selfReflectionAnswer: 'I learned X' }).isComplete
            ).toBe(true);
        });

        it('should return isComplete: false for empty string', () => {
            expect(
                evaluateCheckpointSubmission({ selfReflectionAnswer: '' }).isComplete
            ).toBe(false);
        });

        it('should return isComplete: false for whitespace-only string', () => {
            expect(
                evaluateCheckpointSubmission({ selfReflectionAnswer: '   \n  ' }).isComplete
            ).toBe(false);
        });

        it('should return isComplete: false for missing field', () => {
            expect(evaluateCheckpointSubmission({}).isComplete).toBe(false);
            expect(evaluateCheckpointSubmission(undefined).isComplete).toBe(false);
            expect(evaluateCheckpointSubmission(null).isComplete).toBe(false);
        });

        it('should return isComplete: false for non-string value', () => {
            expect(
                evaluateCheckpointSubmission({ selfReflectionAnswer: 42 as any }).isComplete
            ).toBe(false);
        });
    });
});