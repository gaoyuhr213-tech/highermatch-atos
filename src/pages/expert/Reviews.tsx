import { useExpertReviews, useSubmitReview } from '../../lib/api/hooks';
import { Star, Clock, Eye, ChevronDown, ChevronUp, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function Reviews() {
  const { data: reviewsData, isLoading, error } = useExpertReviews();
  const submitMutation = useSubmitReview();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});

  const handleScore = (reviewId: string, dim: string, score: number) => {
    setScores(prev => ({ ...prev, [reviewId]: { ...(prev[reviewId] || {}), [dim]: score } }));
  };

  const handleSubmit = (reviewId: string) => {
    const reviewScores = scores[reviewId] || {};
    const avgScore = Object.values(reviewScores).reduce((a, b) => a + b, 0) / Object.values(reviewScores).length;
    submitMutation.mutate({ id: reviewId, payload: { score: avgScore, comments: '' } });
    setSubmitted(prev => new Set([...prev, reviewId]));
  };

  const dimensions = ['专业深度', '实战经验', '学习能力', '团队协作', '创新思维'];

  if (isLoading) return <div className="p-8 flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="ml-3 text-slate-500">加载评审任务...</span></div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败：{(error as Error).message}</div>;

  const expertReviews = reviewsData?.items || [];

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">评审任务</h1><p className="text-sm text-slate-500 mt-1">Expert Reviews · 匿名化同行专业评审</p></div>
        <div className="flex items-center gap-3">
          <span className="badge badge-yellow">{expertReviews.filter(r => r.status === 'pending').length} 待评审</span>
          <span className="badge badge-green">{submitted.size} 已提交</span>
        </div>
      </div>

      <div className="glass-card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-trust-500">
        <Shield className="w-5 h-5 text-trust-500" />
        <div>
          <p className="text-sm font-medium text-slate-700">所有评审均已脱敏处理，确保评审公正性</p>
          <p className="text-xs text-slate-500">评审结果将通过CA签名存证，不可篡改</p>
        </div>
      </div>

      <div className="space-y-4">
        {expertReviews.map(r => {
          const isExpanded = expanded === r.id;
          const isSubmitted = submitted.has(r.id);
          const reviewScores = scores[r.id] || {};
          return (
            <div key={r.id} className={`glass-card overflow-hidden transition-all ${isSubmitted ? 'border-l-4 border-l-success-400' : ''}`}>
              <div className="p-5 flex items-center gap-5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : r.id)}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.status === 'pending' && !isSubmitted ? 'bg-warning-50' : 'bg-success-50'}`}>
                  {isSubmitted ? <CheckCircle2 className="w-6 h-6 text-success-500" /> : <Star className={`w-6 h-6 ${r.status === 'pending' ? 'text-warning-500' : 'text-primary-500'}`} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-800">{r.anonymized ? '匿名候选人' : r.candidate}</h3>
                    <span className={`badge ${isSubmitted ? 'badge-green' : r.status === 'pending' ? 'badge-yellow' : 'badge-blue'}`}>
                      {isSubmitted ? '已提交' : r.status === 'pending' ? '待评审' : '评审中'}
                    </span>
                    {r.anonymized && <span className="badge badge-blue text-[10px]"><Eye className="w-3 h-3" />已脱敏</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{r.position} · {r.domain}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />截止 {r.deadline}</span>
                    <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />{r.dimensions?.length || 5}个评审维度</span>
                  </div>
                </div>
                <div className="text-right mr-4">
                  <p className="text-lg font-bold text-primary-600">{r.reward}</p>
                  <p className="text-[10px] text-slate-400">积分奖励</p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                  {isSubmitted ? (
                    <div className="p-4 bg-success-50 rounded-xl text-center">
                      <CheckCircle2 className="w-8 h-8 text-success-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-success-700">评审已提交，CA签名存证中</p>
                      <p className="text-xs text-success-600 mt-1">奖励积分将在24小时内到账</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500">请对候选人以下维度进行1-10分评分：</p>
                      <div className="grid grid-cols-1 gap-3">
                        {dimensions.map(dim => (
                          <div key={dim} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50">
                            <span className="text-sm text-slate-700 w-24">{dim}</span>
                            <div className="flex items-center gap-1 flex-1">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <button key={n} onClick={() => handleScore(r.id, dim, n)}
                                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${(reviewScores[dim] || 0) >= n ? 'bg-primary-500 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-primary-300'}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                            <span className="text-sm font-bold text-primary-600 w-8 text-right">{reviewScores[dim] || '-'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-slate-400">提交后评审结果将通过SM2签名加密存证</p>
                        <button onClick={() => handleSubmit(r.id)} disabled={Object.keys(reviewScores).length < dimensions.length}
                          className="btn-primary disabled:opacity-50">
                          <Shield className="w-4 h-4" />提交评审 (CA签名)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
