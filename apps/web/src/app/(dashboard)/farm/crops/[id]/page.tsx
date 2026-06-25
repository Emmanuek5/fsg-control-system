import { CropDetail } from '@/components/farm/crop-detail';

export default async function CropDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CropDetail cropId={id} />;
}
