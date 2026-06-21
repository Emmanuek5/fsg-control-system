import { BatchDetail } from '@/components/farm/batch-detail';

export default async function LayerBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchDetail batchId={id} type="LAYERS" />;
}
