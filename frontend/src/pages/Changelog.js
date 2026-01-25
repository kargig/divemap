import {
  RocketOutlined,
  ToolOutlined,
  BugOutlined,
  DatabaseOutlined,
  GithubOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  BgColorsOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Typography, Card, Tag, Button, Row, Col, Divider, Space, Grid } from 'antd';
import { Collapse } from 'antd-mobile';
import React from 'react';

import usePageTitle from '../hooks/usePageTitle';

const { Title, Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

const Changelog = () => {
  usePageTitle('Divemap - Changelog');
  const screens = useBreakpoint();

  const getIcon = type => {
    switch (type) {
      case 'feature':
        return <RocketOutlined style={{ color: '#1890ff' }} />;
      case 'improvement':
        return <ToolOutlined style={{ color: '#52c41a' }} />;
      case 'bugfix':
        return <BugOutlined style={{ color: '#f5222d' }} />;
      case 'database':
        return <DatabaseOutlined style={{ color: '#722ed1' }} />;
      case 'ux':
        return <BgColorsOutlined style={{ color: '#fa8c16' }} />;
      case 'security':
        return <SafetyCertificateOutlined style={{ color: '#faad14' }} />;
      case 'infra':
        return <ThunderboltOutlined style={{ color: '#13c2c2' }} />;
      default:
        return <FileTextOutlined />;
    }
  };

  const releases = [
    {
      date: 'January 22, 2026',
      title: 'New Features & Infrastructure Overhaul',
      tag: 'Latest Release',
      sections: [
        {
          title: 'Major Features',
          type: 'feature',
          color: 'blue',
          items: [
            'Media Gallery Enhancements: Route markers media, deep linking, lightbox improvements.',
            'Diving Tools: High-precision physics engine, Min Gas, MOD, Best Mix calculators.',
            'Certifications System: Full CRUD for diving certifications, social media links.',
            'PWA Support: Installable mobile experience.',
          ],
        },
        {
          title: 'Improvements',
          type: 'improvement',
          color: 'green',
          items: [
            'Vite Migration: Faster builds and development.',
            'TanStack Table: Server-side admin tables.',
            'Comprehensive SEO: Sitemap, Metadata, Schema.org.',
            'Performance: `orjson` serialization, image optimization (WebP).',
            'Ant Design Refactor: Navbar and Admin pages.',
          ],
        },
        {
          title: 'Bug Fixes',
          type: 'bugfix',
          color: 'red',
          items: [
            'Fixed HTML entity double-encoding.',
            'Fixed Google Search Console schema errors.',
            'Resolved database schema drift.',
            'Fixed backend cold start timeouts.',
          ],
        },
      ],
    },
    {
      date: 'December 19, 2025',
      title: 'Notification System & Dive Buddies',
      sections: [
        {
          title: 'Major Features',
          type: 'feature',
          items: [
            'Comprehensive Notification System with AWS Integration.',
            'Real-Time In-App Notifications.',
            'Dive Buddies Functionality with Privacy Controls.',
            'Wind Overlay with Real-Time Weather Data.',
            'Intelligent Dive Site Suitability Recommendations.',
          ],
        },
        {
          title: 'Improvements',
          type: 'improvement',
          color: 'green',
          items: [
            'Database Backup Script using mysqldump.',
            'Enhanced Auth Resilience.',
            'Dynamic Dive Site Search with Attiki Prefetch.',
            'Time-Based Forecast Caching Strategy.',
            'Optimized Wind Data Caching.',
          ],
        },
        {
          title: 'Bug Fixes',
          type: 'bugfix',
          color: 'red',
          items: [
            'Fixed HTML Entity Encoding in Route Descriptions.',
            'Fixed Security Issues in Dive Buddies.',
            'Fixed Wind Arrow Direction and Display.',
          ],
        },
        {
          title: 'Database',
          type: 'database',
          color: 'purple',
          items: [
            'New Notification System Tables.',
            'Dive Buddies Junction Table.',
            'Shore Direction Field in Dive Sites.',
          ],
        },
      ],
    },
    {
      date: 'November 03, 2025',
      title: 'Dive Routes, Sharing & Global Search',
      sections: [
        {
          title: 'Major Features',
          type: 'feature',
          items: [
            'Comprehensive Dive Route Drawing and Selection System.',
            'Share/Social Media Integration.',
            'Global Navbar Search.',
            'Settings System for Runtime Configuration.',
            'Diving Center Reviews Control.',
          ],
        },
        {
          title: 'Improvements',
          type: 'improvement',
          color: 'green',
          items: [
            'Route Map Enhancements (Compass, Layers).',
            'Multi-Platform Social Sharing.',
            'Real-Time Global Search.',
            'Enhanced Phone Number Validation.',
          ],
        },
        {
          title: 'Bug Fixes',
          type: 'bugfix',
          color: 'red',
          items: [
            'Fixed HTTPS Protocol Issues.',
            'Fixed Search Endpoint Redirects.',
            'Fixed Route Canvas Callbacks.',
          ],
        },
        {
          title: 'Database',
          type: 'database',
          color: 'purple',
          items: [
            'New Settings Table.',
            'Difficulty Levels Lookup Table.',
            'MySQL POINT Geometry for Spatial Queries.',
          ],
        },
      ],
    },
    {
      date: 'September 27, 2025',
      title: 'Dive Profiles & Map System Migration',
      sections: [
        {
          title: 'Major Features',
          type: 'feature',
          items: [
            'Interactive Dive Profile Charts with Touch Support.',
            'OpenLayers to Leaflet Migration.',
            'Enhanced Mobile Experience.',
          ],
        },
        {
          title: 'Security',
          type: 'security',
          color: 'orange',
          items: [
            'Enhanced Data Protection.',
            'Secure Profile Storage (R2).',
            'Mobile Security Improvements.',
          ],
        },
      ],
    },
    {
      date: 'August 24, 2025',
      title: 'Reverse Proxy, Turnstile & Geocoding',
      sections: [
        {
          title: 'Major Features',
          type: 'feature',
          items: [
            'Nginx Reverse Proxy Architecture.',
            'Cloudflare Turnstile Integration.',
            'Diving Center Reverse Geocoding.',
            'Greek Date Support in Newsletter Parsing.',
          ],
        },
        {
          title: 'Infrastructure',
          type: 'infra',
          color: 'cyan',
          items: ['Fly.io Production Deployment.', 'Docker Optimization.'],
        },
      ],
    },
  ];

  const renderSection = (section, isMobile) => (
    <Card
      type='inner'
      size={isMobile ? 'small' : 'default'}
      title={
        <Space>
          {getIcon(section.type)}
          {section.title}
        </Space>
      }
      className={`mb-4 shadow-sm h-full ${isMobile ? 'text-sm' : ''}`}
      styles={{ header: { backgroundColor: `var(--ant-${section.color || 'blue'}-1)` } }}
    >
      <ul className='list-disc pl-5 space-y-1 mb-0'>
        {section.items.map((item, idx) => (
          <li key={idx}>
            <Text className={isMobile ? 'text-xs' : ''}>{item}</Text>
          </li>
        ))}
      </ul>
    </Card>
  );

  const renderReleaseContent = (release, isMobile) => (
    <Card
      variant={isMobile ? 'outlined' : 'borderless'}
      className={isMobile ? 'bg-gray-50' : 'shadow-sm bg-white'}
      styles={{ body: { padding: isMobile ? '12px' : '24px' } }}
    >
      {isMobile ? (
        <div className='flex flex-col gap-4'>
          {release.sections.map((section, idx) => (
            <div key={idx}>{renderSection(section, isMobile)}</div>
          ))}
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {release.sections.map((section, idx) => (
            <Col xs={24} md={12} key={idx}>
              {renderSection(section, isMobile)}
            </Col>
          ))}
        </Row>
      )}
    </Card>
  );

  return (
    <div className='min-h-screen bg-gray-50 pt-20 pb-12'>
      <div className='max-w-5xl mx-auto px-4'>
        {/* Header */}
        <div className='text-center mb-12'>
          <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          <Title level={1} style={{ marginTop: '16px', marginBottom: '8px' }}>
            Changelog
          </Title>
          <Paragraph
            type='secondary'
            style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}
          >
            Track all recent changes, improvements, and bug fixes to the Divemap application.
          </Paragraph>
        </div>

        {screens.xs ? (
          /* Mobile View: Accordion style */
          <div className='mobile-changelog-container'>
            <Collapse accordion defaultActiveKey={releases[0].date}>
              {releases.map(release => (
                <Collapse.Panel
                  key={release.date}
                  title={
                    <div className='flex flex-col py-1'>
                      <span className='font-bold text-gray-800'>{release.date}</span>
                      <span className='text-xs text-gray-500'>{release.title}</span>
                    </div>
                  }
                >
                  <div className='py-2'>{renderReleaseContent(release, true)}</div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </div>
        ) : (
          /* Desktop View: Custom Vertical Feed */
          <div className='desktop-changelog-feed relative pl-8'>
            {/* Continuous vertical line background */}
            <div className='absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block' />

            {releases.map((release, idx) => (
              <div key={idx} className='mb-16 relative md:pl-12'>
                {/* Date Marker */}
                <div className='hidden md:flex absolute left-[25.5px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm z-10 items-center justify-center' />

                <div className='mb-6'>
                  <Space align='center' className='mb-1'>
                    {release.tag && <Tag color='blue'>{release.tag}</Tag>}
                    <Title level={3} className='!mb-0'>
                      {release.date}
                    </Title>
                  </Space>
                  <Text type='secondary' className='text-lg block'>
                    {release.title}
                  </Text>
                </div>

                {renderReleaseContent(release, false)}
              </div>
            ))}
          </div>
        )}

        <Divider />

        <div className='text-center mt-12'>
          <Card className='bg-gray-50 border-none shadow-none'>
            <Space direction='vertical' size='large'>
              <GithubOutlined style={{ fontSize: '32px' }} />
              <Title level={3}>View Complete Changelog</Title>
              <Paragraph>
                For detailed information about all changes, visit our complete changelog on GitHub.
              </Paragraph>
              <Button
                type='primary'
                icon={<GithubOutlined />}
                size='large'
                href='https://github.com/kargig/divemap/blob/main/docs/maintenance/changelog.md'
                target='_blank'
              >
                View on GitHub
              </Button>
              <Space
                orientation={screens.xs ? 'vertical' : 'horizontal'}
                separator={!screens.xs && <Divider orientation='vertical' />}
                size={screens.xs ? 'small' : 'middle'}
              >
                <Space>
                  <GlobalOutlined /> User Experience
                </Space>
                <Space>
                  <ToolOutlined /> Technical Improvements
                </Space>
                <Space>
                  <SafetyCertificateOutlined /> Security & Stability
                </Space>
              </Space>
              <Paragraph type='secondary' style={{ marginTop: '16px' }}>
                Last updated: January 22, 2026
              </Paragraph>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Changelog;
