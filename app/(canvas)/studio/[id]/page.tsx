import StudioWorkspaceLoader from '../../../components/studio/canvas/StudioWorkspaceLoader';

export default async function StudioProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioWorkspaceLoader projectId={id} />;
}
