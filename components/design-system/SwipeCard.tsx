// components/design-system/SwipeCard.tsx
import React from 'react';
import { Card } from '@/components/design-system/Card';
import { Avatar } from '@/components/design-system/Avatar';
import { Button } from '@/components/design-system/Button';
import { Icon } from '@/components/design-system/Icon';
import { Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Profile = {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string | null;
  age?: number;
  city?: string;
  church_name?: string;
  interests?: string[];
};

export interface SwipeCardProps {
  profile: Profile;
  onLike: (id: string) => Promise<void>;
  onPass: (id: string) => Promise<void>;
  loading?: boolean;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  profile,
  onLike,
  onPass,
  loading = false,
}) => {
  const handleLike = async () => {
    if (loading) return;
    await onLike(profile.id);
  };
  const handlePass = async () => {
    if (loading) return;
    await onPass(profile.id);
  };

  return (
    <Card className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden shadow-lg">
      <div className="relative aspect-square">
        <img
          src={profile.avatar_url ?? '/placeholder-avatar.svg'}
          alt={profile.full_name ?? profile.username}
          className="object-cover w-full h-full"
        />
        {/* Overlay info */}
        <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white p-4">
          <h2 className="text-lg font-semibold">{profile.full_name ?? profile.username}</h2>
          <p className="text-sm">
            {profile.age ? `${profile.age} tuổi` : ''}
            {profile.city ? ` • ${profile.city}` : ''}
            {profile.church_name ? ` • ${profile.church_name}` : ''}
          </p>
          {profile.interests && profile.interests.length > 0 && (
            <p className="mt-1 text-xs">Sở thích: {profile.interests.join(', ')}</p>
          )}
        </div>
      </div>
      {/* Action buttons */}
      <div className="flex justify-around p-4 bg-surface">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePass}
          disabled={loading}
          className="text-red-500 hover:bg-red-100"
        >
          <Icon as={X} aria-label="Pass" />
        </Button>
        <Button
          variant="primary"
          size="icon"
          onClick={handleLike}
          disabled={loading}
          className="text-green-500 hover:bg-green-100"
        >
          <Icon as={Heart} aria-label="Like" />
        </Button>
      </div>
    </Card>
  );
};
