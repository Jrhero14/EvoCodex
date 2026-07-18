import React, { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Database, Cpu, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

/**
 * Parse log text to determine the status of each pipeline phase.
 * Returns: { phase1: 'idle'|'running'|'success'|'error', phase2: ..., phase3: ... }
 */
function parsePipelinePhases(logText, jobStatus) {
  const phases = {
    phase1: 'idle',
    phase2: 'idle',
    phase3: 'idle',
  };

  if (!logText || logText === 'Loading logs...') {
    if (jobStatus === 'IN_PROGRESS') phases.phase1 = 'running';
    return phases;
  }

  const hasPhase1Start = logText.includes('PHASE 1: GIT SYNCHRONIZATION');
  const hasPhase1Error = logText.includes('Git operation failed');
  const hasPhase2Start = logText.includes('PHASE 2: COCOINDEX EMBEDDING');
  const hasPhase2Failed = logText.includes('PHASE 2 FAILED') || logText.includes('PHASE 2 ERROR');
  const hasPhase2Complete = logText.includes('PHASE 2 COMPLETE');
  const hasPhase3Start = logText.includes('PHASE 3: SAVING TO DATABASE');
  const hasPhase3Complete = logText.includes('PHASE 3 COMPLETE');
  const hasAllComplete = logText.includes('ALL PHASES COMPLETED SUCCESSFULLY');

  // Phase 1
  if (hasPhase1Start) {
    if (hasPhase1Error) {
      phases.phase1 = 'error';
      return phases;
    } else if (hasPhase2Start) {
      phases.phase1 = 'success';
    } else {
      phases.phase1 = jobStatus === 'IN_PROGRESS' ? 'running' : (jobStatus === 'FAILED' ? 'error' : 'success');
    }
  } else if (jobStatus === 'IN_PROGRESS') {
    phases.phase1 = 'running';
    return phases;
  }

  // Phase 2
  if (hasPhase2Start) {
    if (hasPhase2Failed) {
      phases.phase2 = 'error';
      return phases;
    } else if (hasPhase2Complete || hasPhase3Start) {
      phases.phase2 = 'success';
    } else {
      phases.phase2 = jobStatus === 'IN_PROGRESS' ? 'running' : (jobStatus === 'FAILED' ? 'error' : 'success');
    }
  }

  // Phase 3
  if (hasPhase3Start) {
    if (hasAllComplete || hasPhase3Complete) {
      phases.phase3 = 'success';
    } else if (jobStatus === 'FAILED') {
      phases.phase3 = 'error';
    } else if (jobStatus === 'IN_PROGRESS') {
      phases.phase3 = 'running';
    } else if (jobStatus === 'SUCCESS') {
      phases.phase3 = 'success';
    }
  }

  // If the job itself is marked as SUCCESS by the backend, all phases must have succeeded
  if (jobStatus === 'SUCCESS') {
    phases.phase1 = 'success';
    phases.phase2 = 'success';
    phases.phase3 = 'success';
  }

  return phases;
}

/* ── Theme-aligned status colors ────────────────────────────────────────
 * bgMain:      #EAE6DF
 * bgPanel:     #F3EFE9
 * textMain:    #1A1A1A
 * textMuted:   #6B6B6B
 * borderColor: #1A1A1A
 * primary:     #4F85AC
 * danger:      #E35876
 * success(gold):#E59E2D
 */
const statusConfig = {
  idle: {
    border: '#C5BFB6',        // muted warm border
    bg: '#F3EFE9',            // bgPanel
    text: '#6B6B6B',          // textMuted
    label: 'Waiting',
    glow: 'none',
    iconBg: '#EAE6DF',
  },
  running: {
    border: '#4F85AC',        // primary
    bg: '#EBF2F7',            // very light blue tint blended with beige
    text: '#3A6B8E',          // primaryHover
    label: 'Running',
    glow: '0 0 12px rgba(79, 133, 172, 0.25)',
    iconBg: '#D9E8F2',
  },
  success: {
    border: '#5A9A5E',        // soft earthy green
    bg: '#EEF4EE',            // very light green tint
    text: '#3D7340',          // darker green
    label: 'Completed',
    glow: 'none',
    iconBg: '#DCE9DC',
  },
  error: {
    border: '#E35876',        // danger color
    bg: '#FAECEF',            // very light pink tint
    text: '#C43D5A',          // darker danger
    label: 'Failed',
    glow: '0 0 12px rgba(227, 88, 118, 0.2)',
    iconBg: '#F3D5DC',
  },
};

const phaseIcons = {
  phase1: GitBranch,
  phase2: Cpu,
  phase3: Database,
};

const phaseLabels = {
  phase1: 'Git Sync',
  phase2: 'CocoIndex',
  phase3: 'Save to DB',
};

const phaseDescriptions = {
  phase1: 'Clone or pull the latest code from the remote repository',
  phase2: 'Split, embed, and index code chunks via CocoIndex',
  phase3: 'Persist indexing results to PostgreSQL database',
};

function StatusIcon({ status }) {
  if (status === 'success') return <CheckCircle2 size={15} style={{ color: '#5A9A5E' }} />;
  if (status === 'error') return <XCircle size={15} style={{ color: '#E35876' }} />;
  if (status === 'running') return <Loader2 size={15} className="pipeline-spinner" style={{ color: '#4F85AC' }} />;
  return <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #C5BFB6' }} />;
}

function PipelineNode({ data }) {
  const { phaseKey, status } = data;
  const config = statusConfig[status];
  const Icon = phaseIcons[phaseKey];
  const label = phaseLabels[phaseKey];
  const description = phaseDescriptions[phaseKey];
  const isRunning = status === 'running';

  return (
    <div
      style={{
        background: config.bg,
        border: `2px solid ${config.border}`,
        borderRadius: 10,
        padding: '12px 18px',
        minWidth: 180,
        maxWidth: 200,
        boxShadow: config.glow !== 'none' ? config.glow : '0 1px 3px rgba(26, 26, 26, 0.08)',
        transition: 'all 0.4s ease',
        position: 'relative',
      }}
    >
      {phaseKey !== 'phase1' && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: config.border,
            width: 7,
            height: 7,
            border: '2px solid #F3EFE9',
          }}
        />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: config.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} style={{ color: config.text }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A', fontFamily: 'Inter, sans-serif' }}>
          {label}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <StatusIcon status={status} />
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 10.5, color: '#6B6B6B', lineHeight: 1.45, fontFamily: 'Inter, sans-serif' }}>
        {description}
      </div>

      {/* Status badge */}
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: config.text,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {isRunning && (
          <span className="pipeline-pulse-dot" />
        )}
        {config.label}
      </div>

      {phaseKey !== 'phase3' && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: config.border,
            width: 7,
            height: 7,
            border: '2px solid #F3EFE9',
          }}
        />
      )}
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

function FitViewUpdater({ phases }) {
  const { fitView } = useReactFlow();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.3, maxZoom: 1 });
    }, 50);
    return () => clearTimeout(timer);
  }, [phases, fitView]);
  
  return null;
}

const BuildPipelineFlow = ({ logText, jobStatus }) => {
  const phases = useMemo(
    () => parsePipelinePhases(logText, jobStatus),
    [logText, jobStatus]
  );

  const nodes = useMemo(
    () => [
      {
        id: 'phase1',
        type: 'pipeline',
        position: { x: 30, y: 25 },
        data: { phaseKey: 'phase1', status: phases.phase1 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'phase2',
        type: 'pipeline',
        position: { x: 305, y: 25 },
        data: { phaseKey: 'phase2', status: phases.phase2 },
        draggable: false,
        selectable: false,
      },
      {
        id: 'phase3',
        type: 'pipeline',
        position: { x: 580, y: 25 },
        data: { phaseKey: 'phase3', status: phases.phase3 },
        draggable: false,
        selectable: false,
      },
    ],
    [phases]
  );

  const edges = useMemo(() => {
    const getEdgeStyle = (fromPhase, toPhase) => {
      const from = phases[fromPhase];
      const to = phases[toPhase];
      if (from === 'success' && (to === 'success' || to === 'running'))
        return { stroke: '#5A9A5E', strokeWidth: 2 };
      if (from === 'error')
        return { stroke: '#E35876', strokeWidth: 2 };
      if (from === 'running')
        return { stroke: '#4F85AC', strokeWidth: 2, strokeDasharray: '6 3' };
      if (from === 'success')
        return { stroke: '#5A9A5E', strokeWidth: 1.5 };
      return { stroke: '#C5BFB6', strokeWidth: 1.5, strokeDasharray: '4 4' };
    };

    return [
      {
        id: 'e1-2',
        source: 'phase1',
        target: 'phase2',
        style: getEdgeStyle('phase1', 'phase2'),
        animated: phases.phase1 === 'running' || (phases.phase1 === 'success' && phases.phase2 === 'running'),
      },
      {
        id: 'e2-3',
        source: 'phase2',
        target: 'phase3',
        style: getEdgeStyle('phase2', 'phase3'),
        animated: phases.phase2 === 'running' || (phases.phase2 === 'success' && phases.phase3 === 'running'),
      },
    ];
  }, [phases]);

  return (
    <div
      style={{
        width: '100%',
        height: 130,
        borderRadius: 10,
        border: '1.5px solid #D5CFC6',
        background: '#EAE6DF',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <style>{`
        .pipeline-spinner {
          animation: pipeline-spin 1s linear infinite;
        }
        @keyframes pipeline-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pipeline-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4F85AC;
          display: inline-block;
          animation: pipeline-pulse 1.5s ease-in-out infinite;
        }
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
        .react-flow__attribution { display: none !important; }
        .react-flow__edge-path { transition: stroke 0.4s ease, stroke-width 0.3s ease; }
      `}</style>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
        >
          <Background color="#D5CFC6" gap={24} size={1} style={{ opacity: 0.4 }} />
          <FitViewUpdater phases={phases} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default BuildPipelineFlow;
