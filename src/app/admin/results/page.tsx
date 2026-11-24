'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Users, Award, AlertTriangle, Eye, X, Trash2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

interface QuizOption {
  id: string;
  title: string;
}

interface AnswerDetail {
  question_id: string;
  question_text: string;
  type: string;
  submitted_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points: number;
}

interface ResponseRecord {
  id: string;
  participant_name: string;
  total_score: number;
  max_possible_score: number;
  answers: AnswerDetail[];
  submitted_at: string;
}

export default function ResultsDashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<ResponseRecord | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (selectedQuizId) {
      fetchResponses(selectedQuizId);
    }
  }, [selectedQuizId]);

  const fetchQuizzes = async () => {
    const { data } = await supabase
      .from('quizzes')
      .select('id, title')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setQuizzes(data);
      setSelectedQuizId(data[0].id);
    } else {
      setLoading(false);
    }
  };

  const fetchResponses = async (quizId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('responses')
      .select('*')
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: false });

    setResponses(data || []);
    setLoading(false);
  };

  // 개선사항 4: 개별 응답 삭제
  const handleDeleteResponse = async (respId: string, name: string) => {
    if (!confirm(`'${name}'님의 응시 기록을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('responses').delete().eq('id', respId);
    if (!error) {
      setResponses(responses.filter((r) => r.id !== respId));
    }
  };

  // 개선사항 4: 해당 퀴즈의 전체 응답 초기화
  const handleResetAllResponses = async () => {
    if (!selectedQuizId || responses.length === 0) return;
    if (!confirm('현재 선택된 퀴즈의 모든 응시 기록을 초기화(전체 삭제)하시겠습니까?\n삭제 후에는 복구할 수 없습니다.')) return;

    const { error } = await supabase.from('responses').delete().eq('quiz_id', selectedQuizId);
    if (!error) {
      setResponses([]);
      alert('모든 응시 기록이 초기화되었습니다.');
    }
  };

  const totalParticipants = responses.length;
  const avgScore =
    totalParticipants > 0
      ? Math.round(responses.reduce((sum, r) => sum + r.total_score, 0) / totalParticipants)
      : 0;

  const questionStats = React.useMemo(() => {
    if (responses.length === 0) return [];
    const firstAnswers = responses[0].answers || [];

    return firstAnswers.map((qItem, qIdx) => {
      let correctCount = 0;
      const distribution: { [ans: string]: number } = {};

      responses.forEach((resp) => {
        const ansObj = resp.answers[qIdx];
        if (ansObj) {
          if (ansObj.is_correct) correctCount++;
          const key = ansObj.submitted_answer;
          distribution[key] = (distribution[key] || 0) + 1;
        }
      });

      const correctRate = Math.round((correctCount / responses.length) * 100);
      const wrongRate = 100 - correctRate;

      return {
        name: `Q${qIdx + 1}`,
        questionText: qItem.question_text,
        correctAnswer: qItem.correct_answer,
        correctRate,
        wrongRate,
        distribution,
      };
    });
  }, [responses]);

  const handleDownloadCSV = () => {
    if (responses.length === 0) return;

    const headers = ['응시자명', '획득점수', '만점', '응시일시', ...questionStats.map((q) => `${q.name}(제출답안)`)];
    const rows = responses.map((r) => [
      `"${r.participant_name}"`,
      r.total_score,
      r.max_possible_score,
      `"${new Date(r.submitted_at).toLocaleString('ko-KR')}"`,
      ...r.answers.map((a) => `"${a.submitted_answer} (${a.is_correct ? 'O' : 'X'})"`),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `퀴즈결과_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-slate-900">📊 결과 제어 및 통계 분석</h1>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>

            <button
              onClick={handleResetAllResponses}
              disabled={responses.length === 0}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40 px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Trash2 size={15} /> 전체 기록 초기화
            </button>

            <button
              onClick={handleDownloadCSV}
              disabled={responses.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Download size={16} /> 엑셀(CSV) 저장
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-center text-slate-500 py-12">응시 데이터를 분석하는 중...</p>
        ) : responses.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center text-slate-500">
            선택한 퀴즈에 아직 응시한 직원이 없습니다.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Users size={26} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">총 응시 인원</p>
                  <p className="text-2xl font-extrabold text-slate-900">{totalParticipants}명</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Award size={26} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">평균 점수</p>
                  <p className="text-2xl font-extrabold text-slate-900">
                    {avgScore}점 <span className="text-sm font-normal text-slate-400">/ {responses[0].max_possible_score}점</span>
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertTriangle size={26} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">가장 오답률이 높은 문항</p>
                  <p className="text-lg font-extrabold text-rose-600">
                    {[...questionStats].sort((a, b) => b.wrongRate - a.wrongRate)[0]?.name}{' '}
                    (오답률 {[...questionStats].sort((a, b) => b.wrongRate - a.wrongRate)[0]?.wrongRate}%)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="font-bold text-base mb-1">문항별 오답률(%) 분석</h2>
                <p className="text-xs text-slate-500 mb-6">오답률이 높은 문항은 추후 보완 교육이 필요합니다.</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={questionStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip formatter={(val) => `${val}%`} />
                      <Bar dataKey="wrongRate" name="오답률" radius={[6, 6, 0, 0]}>
                        {questionStats.map((entry, index) => (
                          <Cell key={index} fill={entry.wrongRate >= 50 ? '#e11d48' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col max-h-[380px] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <h2 className="font-bold text-base">문항별 응답 분포 상세</h2>
                </div>
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  {questionStats.map((q, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {q.name}. {q.questionText}
                        </p>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                            q.wrongRate >= 50 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          정답률 {q.correctRate}%
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 font-semibold">정답: {q.correctAnswer}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(q.distribution).map(([ans, count]) => (
                          <span
                            key={ans}
                            className={`text-xs px-2.5 py-1 rounded-md border ${
                              ans === q.correctAnswer
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {ans}: {count}명 ({Math.round((count / totalParticipants) * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="font-bold text-base">직원별 응시 현황 및 상세 답안</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="px-5 py-3.5">응시자 (성명/부서)</th>
                      <th className="px-5 py-3.5">획득 점수</th>
                      <th className="px-5 py-3.5">정답 문항 수</th>
                      <th className="px-5 py-3.5">제출 일시</th>
                      <th className="px-5 py-3.5 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {responses.map((r) => {
                      const correctCnt = r.answers.filter((a) => a.is_correct).length;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">{r.participant_name}</td>
                          <td className="px-5 py-3.5 font-extrabold text-blue-600">
                            {r.total_score}점 <span className="text-slate-400 font-normal">/ {r.max_possible_score}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {correctCnt} / {r.answers.length}문제
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs">
                            {new Date(r.submitted_at).toLocaleString('ko-KR')}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedParticipant(r)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                              >
                                <Eye size={14} /> 답안지 확인
                              </button>
                              <button
                                onClick={() => handleDeleteResponse(r.id, r.participant_name)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="이 기록 삭제"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {selectedParticipant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl">
            <div className="p-5 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{selectedParticipant.participant_name}님의 상세 답안</h3>
                <p className="text-xs text-slate-500">
                  총점: {selectedParticipant.total_score}점 / {selectedParticipant.max_possible_score}점
                </p>
              </div>
              <button onClick={() => setSelectedParticipant(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {selectedParticipant.answers.map((ans, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border ${
                    ans.is_correct ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-800">
                      Q{idx + 1}. {ans.question_text}
                    </p>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded ${
                        ans.is_correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {ans.is_correct ? '정답' : '오답'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    제출 답안: <strong>{ans.submitted_answer}</strong>
                  </p>
                  {!ans.is_correct && (
                    <p className="text-xs text-rose-700 mt-0.5">
                      실제 정답: <strong>{ans.correct_answer}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}