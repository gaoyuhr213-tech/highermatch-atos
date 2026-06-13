import { useState } from 'react';
import { Users, MessageCircle, ThumbsUp, Eye, Shield, CheckCircle, TrendingUp, Bookmark, Filter, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import CABadge from '../../components/CABadge';

interface CommunityPost {
  id: string;
  author: string;
  company: string;
  caVerified: boolean;
  avatar: string;
  title: string;
  content: string;
  category: string;
  likes: number;
  comments: number;
  views: number;
  timestamp: string;
  tags: string[];
}

const mockPosts: CommunityPost[] = [
  {
    id: 'P-001', author: '李经理', company: '蜀道集团', caVerified: true, avatar: 'L',
    title: '中小微企业如何在有限预算下招到合适的技术人才？',
    content: '我们公司规模200人，今年技术团队需要扩招15人。预算有限，但市场竞争激烈。分享几个我们验证有效的方法：1) 突出真实工作环境和成长空间；2) 利用CA认证标识提升企业可信度；3) 在岗位答疑中主动公开薪资结构...',
    category: '招聘经验', likes: 128, comments: 34, views: 1520, timestamp: '2小时前',
    tags: ['技术招聘', '预算控制', '中小微']
  },
  {
    id: 'P-002', author: '张HR', company: '川投数字', caVerified: true, avatar: 'Z',
    title: '试用期留存率从60%提升到85%的实操方法',
    content: '去年我们试用期离职率高达40%，今年通过以下措施降到15%：1) 入职前通过岗位真实答疑让候选人充分了解工作内容；2) 设置30/60/90天check-in机制；3) 建立新人buddy制度...',
    category: '留人策略', likes: 256, comments: 67, views: 3200, timestamp: '5小时前',
    tags: ['留存率', '试用期', '最佳实践']
  },
  {
    id: 'P-003', author: '王总监', company: '天府软件园', caVerified: true, avatar: 'W',
    title: '如何评估AI面试工具的实际效果？我们的A/B测试数据',
    content: '我们对比了传统电话筛选和AI异步面试两种方式，样本量各200人。结果：AI面试组到面率提升22%【待验证】，面试官满意度提升18%。关键发现是AI面试能更好地评估候选人的真实表达能力...',
    category: '工具评测', likes: 189, comments: 45, views: 2800, timestamp: '1天前',
    tags: ['AI面试', 'A/B测试', '数据驱动']
  },
  {
    id: 'P-004', author: '陈HRBP', company: '成都银行', caVerified: true, avatar: 'C',
    title: '国企招聘合规要点：从发布到入职的全流程checklist',
    content: '整理了一份国企招聘合规清单，涵盖岗位发布审批、面试记录留存、背景调查合规、offer审批流程等环节。特别注意：所有操作需可审计追溯，数据隔离要求严格执行...',
    category: '合规实务', likes: 312, comments: 89, views: 4500, timestamp: '2天前',
    tags: ['国企', '合规', '流程标准化']
  },
];

const categories = ['全部', '招聘经验', '留人策略', '工具评测', '合规实务', '薪酬洞察'];

// Feature Flag: 匿名情绪社区默认关闭
const FEATURE_FLAG_ANONYMOUS_EMOTION = false;

export default function Community() {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = activeCategory === '全部'
    ? mockPosts
    : mockPosts.filter(p => p.category === activeCategory);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">同行互助圈</h1>
          <p className="text-sm text-muted mt-1">CA认证HR实名交流 · 招聘经验共享 · 数据驱动决策</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 rounded-lg border border-brand-100">
            <Shield className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-xs font-semibold text-brand-700">实名理性社区</span>
          </div>
          {FEATURE_FLAG_ANONYMOUS_EMOTION && (
            <div className="px-3 py-1.5 bg-ink-100 rounded-lg">
              <span className="text-xs text-muted">匿名模式(已关闭)</span>
            </div>
          )}
        </div>
      </div>

      {/* 搜索与分类 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索话题、经验、方法论..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-surface text-muted hover:bg-ink-50 border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 帖子列表 */}
      <div className="grid grid-cols-1 gap-4">
        {filteredPosts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-surface rounded-xl border border-border/80 shadow-card p-5 hover:shadow-card-hover transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {post.avatar}
              </div>

              <div className="flex-1 min-w-0">
                {/* Author info */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-foreground">{post.author}</span>
                  <span className="text-xs text-muted">{post.company}</span>
                  {post.caVerified && <CABadge size="sm" />}
                  <span className="text-xs text-muted ml-auto">{post.timestamp}</span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-foreground group-hover:text-brand-700 transition-colors">
                  {post.title}
                </h3>

                {/* Content preview */}
                <p className="text-sm text-muted mt-2 line-clamp-2 leading-relaxed">{post.content}</p>

                {/* Tags */}
                <div className="flex items-center gap-2 mt-3">
                  {post.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-ink-50 rounded-md text-[10px] font-medium text-muted border border-border">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <ThumbsUp className="w-3.5 h-3.5" />{post.likes}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <MessageCircle className="w-3.5 h-3.5" />{post.comments}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Eye className="w-3.5 h-3.5" />{post.views}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted ml-auto">
                    <span className="px-2 py-0.5 bg-ink-50 rounded text-[10px] font-medium">{post.category}</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
