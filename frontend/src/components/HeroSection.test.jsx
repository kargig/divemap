import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import HeroSection from './HeroSection';

describe('HeroSection Component Assets', () => {
  it('renders modern WebP background images when logoBackground is enabled', () => {
    const { container } = render(
      <HeroSection
        title='Dive Sites Explorer'
        subtitle='Find diving sites across the globe'
        logoBackground={true}
      />
    );

    const desktopBg = container.querySelector('img[src="/divemap-logo-hero-background.webp"]');
    const mobileBg = container.querySelector(
      'img[src="/divemap-logo-hero-background-mobile.webp"]'
    );
    expect(desktopBg).toBeInTheDocument();
    expect(mobileBg).toBeInTheDocument();
  });

  it('renders modern WebP extended logo in three-column layout', () => {
    const { container } = render(
      <HeroSection title='Dive Sites' threeColumnLayout={true} logoBackground={true} />
    );

    const extendedLogo = container.querySelector(
      'img[src="/divemap_logo_domain_top5_extend.webp"]'
    );
    expect(extendedLogo).toBeInTheDocument();
  });

  it('renders hero-large logo as WebP', () => {
    const { container } = render(
      <HeroSection title='Welcome to Divemap' showLogo={true} logoSize='hero-large' />
    );

    const logo = container.querySelector('img[src="/divemap-logo-hero-large.webp"]');
    expect(logo).toBeInTheDocument();
  });
});
