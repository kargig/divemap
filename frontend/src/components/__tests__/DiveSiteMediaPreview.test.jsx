import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import DiveSiteMediaPreview from '../DiveSiteMediaPreview';

describe('DiveSiteMediaPreview', () => {
  const mockPhoto = {
    id: 1,
    url: 'https://example.com/photo.jpg',
    medium_url: 'https://example.com/photo_medium.jpg',
    media_type: 'photo',
    description: 'Beautiful coral',
  };

  const mockVideo = {
    id: 2,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    media_type: 'video',
    description: 'Dive video',
  };

  it('renders nothing if no featuredItem or empty media', () => {
    const { container } = render(
      <DiveSiteMediaPreview
        media={[]}
        featuredItem={null}
        photosCount={0}
        videosCount={0}
        onOpenPhoto={vi.fn()}
        onOpenVideo={vi.fn()}
        onViewAll={vi.fn()}
        getImageUrl={url => url}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders photo preview with badge and handles click', () => {
    const onOpenPhoto = vi.fn();
    render(
      <DiveSiteMediaPreview
        media={[mockPhoto]}
        featuredItem={mockPhoto}
        photosCount={3}
        videosCount={1}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={vi.fn()}
        onViewAll={vi.fn()}
        getImageUrl={url => url}
      />
    );

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo_medium.jpg');
    expect(screen.getByText(/3 photos/i)).toBeInTheDocument();

    fireEvent.click(img);
    expect(onOpenPhoto).toHaveBeenCalledWith(mockPhoto);
  });

  it('renders video preview with play button and handles click', () => {
    const onOpenVideo = vi.fn();
    render(
      <DiveSiteMediaPreview
        media={[mockVideo]}
        featuredItem={mockVideo}
        photosCount={0}
        videosCount={2}
        onOpenPhoto={vi.fn()}
        onOpenVideo={onOpenVideo}
        onViewAll={vi.fn()}
        getImageUrl={url => url}
      />
    );

    expect(screen.getByText(/2 videos/i)).toBeInTheDocument();
    const playButton = screen.getByRole('button', { name: /play video/i });
    expect(playButton).toBeInTheDocument();

    fireEvent.click(playButton);
    expect(onOpenVideo).toHaveBeenCalledWith(mockVideo);
  });
});
