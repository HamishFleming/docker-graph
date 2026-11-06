import { useEffect, useState } from 'react';
import ReactFlow, { useNodesInitialized, useReactFlow, ReactFlowProvider } from 'reactflow';
import { parseCompose } from './lib/parser';
import { ServiceNode, NetworkNode, VolumeNode } from './components/nodes';
const nodeTypes = { service: ServiceNode, network: NetworkNode, volume: VolumeNode };
declare global { interface Window { renderCompose: (yaml: string) => void; renderStatus: string; renderError?: string } }
function Ready() {
  const initialized = useNodesInitialized();
  const flow = useReactFlow();
  useEffect(() => {
    if (!initialized) return;
    void (async () => {
      await document.fonts.ready;
      flow.fitView({ padding: 0.15, minZoom: 0.001, maxZoom: 1.2 });
      requestAnimationFrame(() => requestAnimationFrame(() => { window.renderStatus = 'ready'; }));
    })();
  }, [initialized, flow]);
  return null;
}
export default function WorkerGraph() {
  const [graph, setGraph] = useState<ReturnType<typeof parseCompose> | null>(null);
  useEffect(() => {
    window.renderCompose = yaml => {
      window.renderStatus = 'rendering';
      try {
        const result = parseCompose(yaml);
        if (result.error || !result.nodes.length) throw new Error(result.error || 'No services to render');
        setGraph(result);
      } catch (error) {
        window.renderError = String(error);
        window.renderStatus = 'error';
      }
    };
    window.renderStatus = 'idle';
  }, []);
  return <div style={{ width: '100vw', height: '100vh', background: '#0d0f17' }}>
    {graph && <ReactFlowProvider><ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes}
      minZoom={0.001} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      proOptions={{ hideAttribution: true }}><Ready /></ReactFlow></ReactFlowProvider>}
  </div>;
}
