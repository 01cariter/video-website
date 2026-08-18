import CreditsDialog from '@/app/components/credits/CreditsDialog';
import CreditsPage from '@/app/components/credits/CreditsPage';

export default function CreditsModalRoute() {
  return (
    <CreditsDialog>
      <CreditsPage />
    </CreditsDialog>
  );
}
