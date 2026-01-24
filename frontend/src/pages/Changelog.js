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
import { Typography, Timeline, Card, Tag, Button, Row, Col, Divider, Space } from 'antd';
import React from 'react';

import usePageTitle from '../hooks/usePageTitle';

const { Title, Paragraph, Text } = Typography;

const Changelog = () => {
  usePageTitle('Divemap - Changelog');

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

  const renderSection = (title, iconType, items, color = 'blue') => (
    <Card
      type='inner'
      title={
        <Space>
          {getIcon(iconType)}
          {title}
        </Space>
      }
      className='mb-4 shadow-sm'
      styles={{ header: { backgroundColor: `var(--ant-${color}-1)` } }}
    >
      <ul className='list-disc pl-5 space-y-1'>
        {items.map((item, idx) => (
          <li key={idx}>
            <Text>{item}</Text>
          </li>
        ))}
      </ul>
    </Card>
  );

  const timelineItems = [
    {
      label: 'January 22, 2026',
      dot: <RocketOutlined style={{ fontSize: '16px', color: '#1890ff' }} />,
      children: (
        <Card
          title={
            <Space>
              <Tag color='blue'>Latest Release</Tag>New Features & Infrastructure Overhaul
            </Space>
          }
          variant='borderless'
          className='shadow-md mb-8'
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {renderSection(
                'Major Features',
                'feature',
                [
                  'Media Gallery Enhancements: Route markers media, deep linking, lightbox improvements.',
                  'Diving Tools: High-precision physics engine, Min Gas, MOD, Best Mix calculators.',
                  'Certifications System: Full CRUD for diving certifications, social media links.',
                  'PWA Support: Installable mobile experience.',
                ],
                'blue'
              )}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Improvements',
                'improvement',
                [
                  'Vite Migration: Faster builds and development.',
                  'TanStack Table: Server-side admin tables.',
                  'Comprehensive SEO: Sitemap, Metadata, Schema.org.',
                  'Performance: `orjson` serialization, image optimization (WebP).',
                  'Ant Design Refactor: Navbar and Admin pages.',
                ],
                'green'
              )}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Bug Fixes',
                'bugfix',
                [
                  'Fixed HTML entity double-encoding.',
                  'Fixed Google Search Console schema errors.',
                  'Resolved database schema drift.',
                  'Fixed backend cold start timeouts.',
                ],
                'red'
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      label: 'December 19, 2025',
      children: (
        <Card
          title='Notification System & Dive Buddies'
          variant='borderless'
          className='shadow-md mb-8'
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {renderSection('Major Features', 'feature', [
                'Comprehensive Notification System with AWS Integration.',
                'Real-Time In-App Notifications.',
                'Dive Buddies Functionality with Privacy Controls.',
                'Wind Overlay with Real-Time Weather Data.',
                'Intelligent Dive Site Suitability Recommendations.',
              ])}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Improvements',
                'improvement',
                [
                  'Database Backup Script using mysqldump.',
                  'Enhanced Auth Resilience.',
                  'Dynamic Dive Site Search with Attiki Prefetch.',
                  'Time-Based Forecast Caching Strategy.',
                  'Optimized Wind Data Caching.',
                ],
                'green'
              )}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Bug Fixes',
                'bugfix',
                [
                  'Fixed HTML Entity Encoding in Route Descriptions.',
                  'Fixed Security Issues in Dive Buddies.',
                  'Fixed Wind Arrow Direction and Display.',
                ],
                'red'
              )}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Database',
                'database',
                [
                  'New Notification System Tables.',
                  'Dive Buddies Junction Table.',
                  'Shore Direction Field in Dive Sites.',
                ],
                'purple'
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      label: 'November 03, 2025',
      children: (
        <Card
          title='Dive Routes, Sharing & Global Search'
          variant='borderless'
          className='shadow-md mb-8'
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {renderSection('Major Features', 'feature', [
                'Comprehensive Dive Route Drawing and Selection System.',
                'Share/Social Media Integration.',
                'Global Navbar Search.',
                'Settings System for Runtime Configuration.',
                'Diving Center Reviews Control.',
              ])}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Improvements',
                'improvement',
                [
                  'Route Map Enhancements (Compass, Layers).',
                  'Multi-Platform Social Sharing.',
                  'Real-Time Global Search.',
                  'Enhanced Phone Number Validation.',
                ],
                'green'
              )}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Bug Fixes',
                'bugfix',
                [
                  'Fixed HTTPS Protocol Issues.',
                  'Fixed Search Endpoint Redirects.',
                  'Fixed Route Canvas Callbacks.',
                ],
                'red'
              )}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Database',
                'database',
                [
                  'New Settings Table.',
                  'Difficulty Levels Lookup Table.',
                  'MySQL POINT Geometry for Spatial Queries.',
                ],
                'purple'
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      label: 'September 27, 2025',
      children: (
        <Card
          title='Dive Profiles & Map System Migration'
          variant='borderless'
          className='shadow-md mb-8'
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {renderSection('Major Features', 'feature', [
                'Interactive Dive Profile Charts with Touch Support.',
                'OpenLayers to Leaflet Migration.',
                'Enhanced Mobile Experience.',
              ])}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Security',
                'security',
                [
                  'Enhanced Data Protection.',
                  'Secure Profile Storage (R2).',
                  'Mobile Security Improvements.',
                ],
                'orange'
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      label: 'August 24, 2025',
      children: (
        <Card
          title='Reverse Proxy, Turnstile & Geocoding'
          variant='borderless'
          className='shadow-md mb-8'
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              {renderSection('Major Features', 'feature', [
                'Nginx Reverse Proxy Architecture.',
                'Cloudflare Turnstile Integration.',
                'Diving Center Reverse Geocoding.',
                'Greek Date Support in Newsletter Parsing.',
              ])}
            </Col>
            <Col xs={24} md={12}>
              {renderSection(
                'Infrastructure',
                'infra',
                ['Fly.io Production Deployment.', 'Docker Optimization.'],
                'cyan'
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

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

        <Timeline mode='left' items={timelineItems} />

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
              <Space split={<Divider type='vertical' />}>
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
