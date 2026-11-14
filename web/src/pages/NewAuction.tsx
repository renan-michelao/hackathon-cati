import { useNavigate } from 'react-router-dom';
import { post, type AuctionDetail } from '../lib/api';
import { AuctionForm } from '../components/AuctionForm';

// RF05: criar leilão com fotos.
export function NewAuction() {
  const nav = useNavigate();
  return (
    <AuctionForm
      mode="create"
      title="Anunciar item"
      submitLabel="Publicar leilão"
      onSubmit={async (fd) => {
        const a = await post<AuctionDetail>('/api/auctions', fd);
        nav(`/leiloes/${a.id}`);
      }}
    />
  );
}
