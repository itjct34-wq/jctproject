import type { Metadata } from 'next';
import { vehicleDetailMetadata } from '@/lib/public/vehicle-metadata';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return vehicleDetailMetadata(params.id, 'machinery');
}

export default function MachineryDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
