'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, ArrowRight, ArrowLeft, Lock } from 'lucide-react';

interface QuizData {
  id: string;
  title: string;
  slug: string;
  description: string;
  show_title: boolean;
  require_name: boolean;
  show_score: boolean;
  is_active: boolean;
  result_badge_text: string;
  bg_type: 'color' | 'image';
  bg_color: string;
  bg_image_url: string;
  main_color: string;
  text_color: string;
  btn_text: string;
  btn_color: string;
  btn_text_color: string;
  result_bg_type: 'inherit' | 'color' | 'image';
  result_bg_color: string;
  result_bg_image_url: string;
  result_text_color: string;
}

interface Question {
  id: string;
  type: 'multiple' | 'ox' | 'short';
  question_text: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  bg_type: 'inherit' | 'color' | 'image';
  bg_color: string;
  bg_image_url: string;
}

interface ResultTier {
  min_score: number;
  max_score: number;
  title: string;
  message: string;
}

export default function QuizTakePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tiers, setTiers] = useState<ResultTier[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<'intro' | 'playing' | 'result'>('intro');
  const [participantName, setParticipantName] = useState('');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const [finalScore, setFinalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [matchedTier, setMatchedTier] = useState<ResultTier | null>(null);

  useEffect(() => {
    fetchQuizData();
  }, [slug]);

  const fetchQuizData = async () => {
    const { data: qData } = await supabase.from('quizzes').select('*').eq('slug', slug).single();
    if (!qData) {
      setLoading(false);
      return;
    }
    setQuiz({
      ...qData,
      show_title: qData.show_title ?? true,
      require_name: qData.require_name ?? true,
      show_score: qData.show_score ?? true,
      is_active: qData.is_active ?? true,
      result_badge_text: qData.result_badge_text ?? '{name}님의 응시 결과',
      result_bg_type: qData.result_bg_type || 'inherit',
      result_bg_color: qData.result_bg_color || '#f8fafc',
      result_bg_image_url: qData.result_bg_image_url || '',
      result_text_color: qData.result_text_color || qData.text_color || '#0f172a',
    });

    const { data: quesData } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', qData.id)
      .order('order_index', { ascending: true });
    if (quesData) setQuestions(quesData);

    const { data: tierData } = await supabase
      .from('result_tiers')
      .select('*')
      .eq('quiz_id', qData.id)
      .order('min_score', { ascending: true });
    if (tierData) setTiers(tierData);

    setLoading(false);
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (quiz?.require_name && !participantName.trim()) {
      alert('응시자 성명 또는 부서를 입력해주세요.');
      return;
    }
    if (questions.length === 0) {
      alert('아직 등록된 문제가 없는 퀴즈입니다.');
      return;
    }
    setStep('playing');
  };

  const handleSubmitQuiz = async () => {
    if (!quiz) return;
    setSubmitting(true);

    let earnedScore = 0;
    let totalPossible = 0;

    const detailedAnswers = questions.map((q, idx) => {
      const submitted = (userAnswers[idx] || '').trim();
      const correct = q.correct_answer.trim();
      const isCorrect =
        q.type === 'short'
          ? submitted.replace(/\s+/g, '').toLowerCase() === correct.replace(/\s+/g, '').toLowerCase()
          : submitted === correct;

      totalPossible += q.points;
      if (isCorrect) earnedScore += q.points;

      return {
        question_id: q.id,
        question_text: q.question_text,
        type: q.type,
        submitted_answer: submitted || '(미응답)',
        correct_answer: correct,
        is_correct: isCorrect,
        points: isCorrect ? q.points : 0,
      };
    });

    const foundTier =
      tiers.find((t) => earnedScore >= t.min_score && earnedScore <= t.max_score) || {
        min_score: 0,
        max_score: 100,
        title: '퀴즈 응시 완료!',
        message: '',
      };

    const finalParticipantName = quiz.require_name ? participantName.trim() : '익명 응시자';

    await supabase.from('responses').insert([
      {
        quiz_id: quiz.id,
        participant_name: finalParticipantName,
        total_score: earnedScore,
        max_possible_score: totalPossible,
        answers: detailedAnswers,
      },
    ]);

    setFinalScore(earnedScore);
    setMaxScore(totalPossible);
    setMatchedTier(foundTier);
    setSubmitting(false);
    setStep('result');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">퀴즈를 불러오는 중...</div>;
  if (!quiz) return <div className="min-h-screen flex items-center justify-center text-slate-600 font-bold">존재하지 않거나 삭제된 퀴즈 링크입니다.</div>;

  // 개선사항 3: 응시 마감된 퀴즈 안내 화면
  if (!quiz.is_active) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">{quiz.title}</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            본 교육 퀴즈는 <strong>응시 기간이 마감</strong>되었습니다.<br />
            문의사항은 교육 담당자에게 연락해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const progressPercent = questions.length > 0 ? Math.round(((currentIdx + 1) / questions.length) * 100) : 0;

  const getCurrentBgStyle = () => {
    if (step === 'playing' && currentQuestion && currentQuestion.bg_type && currentQuestion.bg_type !== 'inherit') {
      if (currentQuestion.bg_type === 'color') {
        return { backgroundColor: currentQuestion.bg_color, backgroundImage: 'none', color: quiz.text_color };
      }
      if (currentQuestion.bg_type === 'image' && currentQuestion.bg_image_url) {
        return { backgroundColor: '#f8fafc', backgroundImage: `url(${currentQuestion.bg_image_url})`, color: quiz.text_color };
      }
    }

    if (step === 'result' && quiz.result_bg_type && quiz.result_bg_type !== 'inherit') {
      if (quiz.result_bg_type === 'color') {
        return { backgroundColor: quiz.result_bg_color, backgroundImage: 'none', color: quiz.result_text_color };
      }
      if (quiz.result_bg_type === 'image' && quiz.result_bg_image_url) {
        return { backgroundColor: '#f8fafc', backgroundImage: `url(${quiz.result_bg_image_url})`, color: quiz.result_text_color };
      }
    }

    return {
      backgroundColor: quiz.bg_type === 'color' ? quiz.bg_color : '#f8fafc',
      backgroundImage: quiz.bg_type === 'image' && quiz.bg_image_url ? `url(${quiz.bg_image_url})` : 'none',
      color: quiz.text_color,
    };
  };

  const hasIntroCardContent = quiz.show_title || quiz.description.trim() !== '' || quiz.require_name;

  const displayName = quiz.require_name ? participantName.trim() : '응시자';
  const renderedBadge = quiz.result_badge_text
    ? quiz.result_badge_text.replace(/\{name\}/g, displayName)
    : '';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center sm:p-4">
      <div
        className="w-full sm:w-[430px] min-h-screen sm:min-h-[764px] sm:max-h-[850px] sm:rounded-[32px] sm:shadow-2xl bg-cover bg-center flex flex-col items-center justify-center p-5 transition-all overflow-y-auto"
        style={getCurrentBgStyle()}
      >
        {/* 1. 메인 시작 화면 */}
        {step === 'intro' && (
          hasIntroCardContent ? (
            <form
              onSubmit={handleStart}
              className="bg-white/90 backdrop-blur-md p-7 rounded-3xl shadow-xl w-full text-center"
            >
              {quiz.show_title && (
                <h1 className="text-2xl font-extrabold mb-3" style={{ color: quiz.text_color }}>
                  {quiz.title}
                </h1>
              )}
              {quiz.description.trim() !== '' && (
                <p className="text-sm mb-7 opacity-85 whitespace-pre-line" style={{ color: quiz.text_color }}>
                  {quiz.description}
                </p>
              )}

              {quiz.require_name && (
                <div className="mb-5 text-left">
                  <label className="block text-xs font-bold mb-1.5 opacity-80" style={{ color: quiz.text_color }}>
                    응시자 성명 / 부서 (또는 사번)
                  </label>
                  <input
                    type="text"
                    required
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="예: 홍길동 (인사팀)"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: quiz.main_color }}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-bold text-base shadow-md hover:opacity-95 transition"
                style={{
                  backgroundColor: quiz.btn_color,
                  color: quiz.btn_text_color,
                }}
              >
                {quiz.btn_text || '퀴즈 풀기'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStart} className="w-full mt-auto mb-6 px-2">
              <button
                type="submit"
                className="w-full py-4 rounded-2xl font-bold text-lg shadow-xl hover:opacity-95 transition"
                style={{
                  backgroundColor: quiz.btn_color,
                  color: quiz.btn_text_color,
                }}
              >
                {quiz.btn_text || '퀴즈 풀기'}
              </button>
            </form>
          )
        )}

        {/* 2. 문제 풀이 화면 */}
        {step === 'playing' && currentQuestion && (
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl shadow-xl w-full text-slate-800">
            <div className="mb-6">
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span style={{ color: quiz.main_color }}>
                  문제 {currentIdx + 1} / {questions.length}
                </span>
                <span className="text-slate-400">{progressPercent}% 진행</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: quiz.main_color,
                  }}
                />
              </div>
            </div>

            <div className="mb-6">
              <span className="inline-block text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-600 mb-2">
                {currentQuestion.points}점
              </span>
              <h2 className="text-lg font-bold leading-snug" style={{ color: quiz.text_color }}>
                Q{currentIdx + 1}. {currentQuestion.question_text}
              </h2>
            </div>

            <div className="mb-7">
              {currentQuestion.type === 'multiple' && (
                <div className="space-y-2.5">
                  {currentQuestion.options.map((opt, idx) => {
                    const selected = userAnswers[currentIdx] === opt;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setUserAnswers({ ...userAnswers, [currentIdx]: opt })}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition flex items-center justify-between ${
                          selected ? 'bg-blue-50/50 font-bold' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                        style={{
                          borderColor: selected ? quiz.main_color : undefined,
                        }}
                      >
                        <span>{opt}</span>
                        {selected && <CheckCircle2 size={18} style={{ color: quiz.main_color }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'ox' && (
                <div className="grid grid-cols-2 gap-4">
                  {['O', 'X'].map((val) => {
                    const selected = userAnswers[currentIdx] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setUserAnswers({ ...userAnswers, [currentIdx]: val })}
                        className={`py-8 rounded-2xl border-2 text-3xl font-extrabold transition ${
                          selected ? 'shadow-md' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                        style={{
                          borderColor: selected ? quiz.main_color : undefined,
                          color: selected ? quiz.main_color : undefined,
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'short' && (
                <input
                  type="text"
                  value={userAnswers[currentIdx] || ''}
                  onChange={(e) => setUserAnswers({ ...userAnswers, [currentIdx]: e.target.value })}
                  placeholder="정답을 직접 입력하세요"
                  className="w-full px-4 py-3.5 border-2 border-slate-300 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: userAnswers[currentIdx] ? quiz.main_color : undefined }}
                />
              )}
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(currentIdx - 1)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 disabled:opacity-30 flex items-center gap-1"
              >
                <ArrowLeft size={16} /> 이전
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!userAnswers[currentIdx]) {
                      alert('답변을 선택하거나 입력해주세요.');
                      return;
                    }
                    setCurrentIdx(currentIdx + 1);
                  }}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-bold flex items-center gap-1 shadow-sm"
                  style={{ backgroundColor: quiz.main_color }}
                >
                  다음 문제 <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (!userAnswers[currentIdx]) {
                      alert('마지막 문제의 답변을 입력해주세요.');
                      return;
                    }
                    handleSubmitQuiz();
                  }}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-bold shadow-md"
                  style={{ backgroundColor: quiz.main_color }}
                >
                  {submitting ? '채점 중...' : '제출하고 결과 보기 ✓'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. 결과 화면 */}
        {step === 'result' && matchedTier && (
          <div className="bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-xl w-full text-center text-slate-800">
            {renderedBadge && (
              <div
                className="inline-block px-4 py-1.5 rounded-full text-xs font-bold text-white mb-4"
                style={{ backgroundColor: quiz.main_color }}
              >
                {renderedBadge}
              </div>
            )}

            {quiz.show_score && (
              <div className="my-4">
                <span className="text-5xl font-black" style={{ color: quiz.main_color }}>
                  {finalScore}
                </span>
                <span className="text-lg font-bold text-slate-400"> / {maxScore}점</span>
              </div>
            )}

            <h2 className="text-2xl font-extrabold mb-3" style={{ color: quiz.result_text_color }}>
              {matchedTier.title}
            </h2>

            {matchedTier.message.trim() !== '' && (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {matchedTier.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}