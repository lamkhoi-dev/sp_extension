import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { Maximize2, Minimize2, Eye, ChevronDown, ChevronRight, Users } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────
const F_COLORS = {
  f0: { bg: 'rgb(16 185 129)', border: '#10b981', label: '🛒 F0', text: 'text-emerald-400' },
  f1: { bg: 'rgb(6 182 212)', border: '#06b6d4', label: '🤝 F1', text: 'text-cyan-400' },
  f2: { bg: 'rgb(14 165 233)', border: '#0ea5e9', label: '🔗 F2', text: 'text-sky-400' },
  f3: { bg: 'rgb(99 102 241)', border: '#6366f1', label: '🌐 F3', text: 'text-indigo-400' },
  custom: { bg: 'rgb(245 158 11)', border: '#f59e0b', label: '✨ Custom', text: 'text-amber-400' },
};

const NODE_W = 200;
const NODE_H = 88;

// ─── Dagre Layout ───────────────────────────────────────
function layoutGraph(nodes, edges) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40, marginx: 20, marginy: 20 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  Dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ─── Custom Node ────────────────────────────────────────
function UserNode({ data }) {
  const { user, fLevel, dimmed, childCount, collapsed, onToggle, onClickUser } = data;
  const isCustom = user.commission_mode === 'custom';
  const fConfig = fLevel ? F_COLORS[fLevel] : null;
  const borderColor = fConfig ? fConfig.border : (isCustom ? '#f59e0b' : '#334155');
  const isHighlighted = !!fLevel;

  return (
    <div
      className="transition-all duration-300 cursor-pointer"
      style={{ opacity: dimmed ? 0.15 : 1 }}
      onClick={(e) => { e.stopPropagation(); onClickUser?.(user); }}
    >
      {/* Incoming edge handle */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-500" />

      <div
        className="rounded-xl px-3 py-2.5 shadow-lg transition-all duration-300"
        style={{
          background: isHighlighted
            ? `linear-gradient(135deg, ${fConfig.bg}15, ${fConfig.bg}08)`
            : 'rgb(30 41 59)',
          border: `2px solid ${borderColor}`,
          width: NODE_W,
          boxShadow: isHighlighted ? `0 0 16px ${fConfig.bg}40` : '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {/* F-level badge */}
        {fLevel && (
          <div
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap"
            style={{ background: fConfig.bg }}
          >
            {fConfig.label}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user_id}`}
            alt=""
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-slate-700"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user.display_name || user.zalo_name || 'Unknown'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isCustom ? (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Custom {user.custom_rate || 0}%
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-600/50 text-slate-400 border border-slate-600">
                  Normal
                </span>
              )}
              {childCount > 0 && (
                <span className="text-[10px] text-slate-400">
                  {childCount} CTV
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expand/Collapse button */}
        {childCount > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle?.(user.user_id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-500 flex items-center justify-center hover:bg-slate-600 hover:border-blue-400 transition-all z-10"
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3 text-slate-300" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-300" />
            )}
          </button>
        )}
      </div>

      {/* Outgoing edge handle */}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-500" style={{ bottom: childCount > 0 ? -12 : -4 }} />
    </div>
  );
}

const nodeTypes = { userNode: UserNode };

// ─── Main Component ─────────────────────────────────────
export default function ReferralTree({ users, onSelectUser }) {
  const [highlightedUserId, setHighlightedUserId] = useState(null);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build child map: referrer_id → [child_user_ids]
  const childMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.referrer_id) {
        if (!map[u.referrer_id]) map[u.referrer_id] = [];
        map[u.referrer_id].push(u.user_id);
      }
    });
    return map;
  }, [users]);

  // Get all descendants of a node (recursive)
  const getDescendants = useCallback((userId) => {
    const result = new Set();
    const queue = [userId];
    while (queue.length > 0) {
      const current = queue.shift();
      const children = childMap[current] || [];
      children.forEach((c) => { result.add(c); queue.push(c); });
    }
    return result;
  }, [childMap]);

  // Determine which nodes are hidden (because a parent is collapsed)
  const hiddenNodes = useMemo(() => {
    const hidden = new Set();
    collapsedNodes.forEach((parentId) => {
      getDescendants(parentId).forEach((d) => hidden.add(d));
    });
    return hidden;
  }, [collapsedNodes, getDescendants]);

  // Trace F0-F3 chain upward from clicked user
  const highlightChain = useMemo(() => {
    if (!highlightedUserId) return {};
    const chain = { [highlightedUserId]: 'f0' };
    const chainEdges = new Set();
    let current = highlightedUserId;
    const levels = ['f1', 'f2', 'f3'];
    for (const level of levels) {
      const user = users.find((u) => u.user_id === current);
      if (!user?.referrer_id) break;
      const parent = users.find((u) => u.user_id === user.referrer_id);
      if (!parent || parent.commission_mode === 'custom') break;
      chain[parent.user_id] = level;
      chainEdges.add(`e-${parent.user_id}-${current}`);
      current = parent.user_id;
    }
    return { nodes: chain, edges: chainEdges };
  }, [highlightedUserId, users]);

  // Toggle collapse
  const toggleNode = useCallback((userId) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  // Click user for highlight
  const handleClickUser = useCallback((user) => {
    setHighlightedUserId((prev) => (prev === user.user_id ? null : user.user_id));
  }, []);

  // Build nodes + edges from users
  useEffect(() => {
    const userMap = {};
    users.forEach((u) => { userMap[u.user_id] = u; });

    // Filter visible nodes
    const visibleUsers = users.filter((u) => !hiddenNodes.has(u.user_id));

    // Create raw nodes
    const rawNodes = visibleUsers.map((u) => ({
      id: u.user_id,
      type: 'userNode',
      position: { x: 0, y: 0 },
      data: {
        user: u,
        fLevel: highlightChain.nodes?.[u.user_id] || null,
        dimmed: highlightedUserId && !highlightChain.nodes?.[u.user_id],
        childCount: (childMap[u.user_id] || []).length,
        collapsed: collapsedNodes.has(u.user_id),
        onToggle: toggleNode,
        onClickUser: handleClickUser,
      },
    }));

    // Create edges (only for visible nodes)
    const visibleSet = new Set(visibleUsers.map((u) => u.user_id));
    const rawEdges = visibleUsers
      .filter((u) => u.referrer_id && visibleSet.has(u.referrer_id))
      .map((u) => {
        const edgeId = `e-${u.referrer_id}-${u.user_id}`;
        const isChainEdge = highlightChain.edges?.has(edgeId);
        const dimmed = highlightedUserId && !isChainEdge;
        return {
          id: edgeId,
          source: u.referrer_id,
          target: u.user_id,
          type: 'default',
          style: {
            stroke: isChainEdge ? F_COLORS[highlightChain.nodes?.[u.user_id]]?.border || '#64748b' : '#334155',
            strokeWidth: isChainEdge ? 3 : 1.5,
            opacity: dimmed ? 0.08 : 1,
            strokeDasharray: isChainEdge ? '8 4' : 'none',
          },
          animated: isChainEdge,
        };
      });

    const laid = layoutGraph(rawNodes, rawEdges);
    setNodes(laid);
    setEdges(rawEdges);
  }, [users, hiddenNodes, highlightChain, highlightedUserId, childMap, collapsedNodes, toggleNode, handleClickUser, setNodes, setEdges]);

  // Expand / Collapse All
  const expandAll = useCallback(() => setCollapsedNodes(new Set()), []);
  const collapseAll = useCallback(() => {
    // Collapse all nodes that have children
    const roots = new Set();
    users.forEach((u) => {
      if ((childMap[u.user_id] || []).length > 0) roots.add(u.user_id);
    });
    // Keep root-level nodes expanded (no referrer)
    users.forEach((u) => {
      if (!u.referrer_id && roots.has(u.user_id)) roots.delete(u.user_id);
    });
    setCollapsedNodes(roots);
  }, [users, childMap]);

  // Default: collapse nodes deeper than level 2
  useEffect(() => {
    if (users.length === 0) return;
    // Find root users and their direct children = visible. Others collapsed.
    const rootIds = users.filter((u) => !u.referrer_id).map((u) => u.user_id);
    const level1Ids = users.filter((u) => rootIds.includes(u.referrer_id)).map((u) => u.user_id);
    const toCollapse = new Set();
    level1Ids.forEach((id) => {
      if ((childMap[id] || []).length > 0) toCollapse.add(id);
    });
    setCollapsedNodes(toCollapse);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length]);

  const stats = useMemo(() => ({
    total: users.length,
    withRef: users.filter((u) => u.referrer_id).length,
    roots: users.filter((u) => !u.referrer_id).length,
  }), [users]);

  return (
    <div className="relative h-full">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={expandAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700/90 text-slate-200 hover:bg-slate-600 border border-slate-600 backdrop-blur-sm transition-all"
        >
          <Maximize2 className="w-3 h-3" /> Expand All
        </button>
        <button
          onClick={collapseAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700/90 text-slate-200 hover:bg-slate-600 border border-slate-600 backdrop-blur-sm transition-all"
        >
          <Minimize2 className="w-3 h-3" /> Collapse All
        </button>
        {highlightedUserId && (
          <button
            onClick={() => setHighlightedUserId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-900/50 text-red-300 hover:bg-red-800/60 border border-red-700/50 backdrop-blur-sm transition-all"
          >
            ✕ Bỏ highlight
          </button>
        )}
      </div>

      {/* Stats badge */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/90 border border-slate-600 backdrop-blur-sm">
        <Users className="w-3 h-3 text-slate-400" />
        <span className="text-[11px] text-slate-300">
          {stats.roots} gốc · {stats.withRef} liên kết · {stats.total} tổng
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 backdrop-blur-sm">
        {Object.entries(F_COLORS).map(([key, c]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.bg }} />
            <span className="text-[10px] text-slate-400">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Chain detail panel */}
      {highlightedUserId && highlightChain.nodes && (
        <div className="absolute bottom-3 right-3 z-10 p-3 rounded-xl bg-slate-800/95 border border-slate-600 backdrop-blur-sm min-w-[180px]">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Commission Chain</p>
          {Object.entries(highlightChain.nodes)
            .sort(([, a], [, b]) => a.localeCompare(b))
            .map(([uid, level]) => {
              const u = users.find((x) => x.user_id === uid);
              const fc = F_COLORS[level];
              const rates = { f0: '40%', f1: '20%', f2: '7%', f3: '3%' };
              return (
                <div key={uid} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: fc.bg }} />
                    <span className="text-xs text-slate-300 truncate max-w-[100px]">{u?.display_name || uid}</span>
                  </div>
                  <span className={`text-xs font-bold ${fc.text}`}>{rates[level]}</span>
                </div>
              );
            })}
          <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-slate-700">
            <span className="text-xs text-slate-500">🏢 Admin</span>
            <span className="text-xs font-bold text-slate-400">
              {100 - Object.values(highlightChain.nodes).reduce((sum, l) => sum + ({ f0: 40, f1: 20, f2: 7, f3: 3 }[l] || 0), 0)}%
            </span>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onPaneClick={() => setHighlightedUserId(null)}
        nodesDraggable={false}
        className="!bg-slate-900"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-slate-800 !border-slate-700 !rounded-lg !shadow-xl [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
        />
      </ReactFlow>
    </div>
  );
}
