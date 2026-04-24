import {
  CompassOutlined,
  EnvironmentOutlined,
  BookOutlined,
  ToolOutlined,
  TeamOutlined,
  BellOutlined,
  CloudOutlined,
  CalculatorOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  MobileOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  GithubOutlined,
  DollarOutlined,
  SearchOutlined,
  GlobalOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import {
  Typography,
  Tabs,
  Card,
  Image,
  Row,
  Col,
  Space,
  Divider,
  Steps,
  Alert,
  Tag,
  Button,
  Grid,
} from 'antd';
import { Collapse, Steps as MobileSteps } from 'antd-mobile';
import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import usePageTitle from '../hooks/usePageTitle';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;
const { useBreakpoint } = Grid;

// Helper icons defined outside component scope
const WeightIcon = props => (
  <span role='img' aria-label='weight' className='anticon' {...props}>
    ⚖️
  </span>
);

const DownloadOutlined = props => (
  <span role='img' aria-label='download' className='anticon' {...props}>
    ⬇️
  </span>
);

const LayersOutlined = props => (
  <span role='img' aria-label='layers' className='anticon' {...props}>
    <svg
      viewBox='64 64 896 896'
      focusable='false'
      data-icon='layers'
      width='1em'
      height='1em'
      fill='currentColor'
      aria-hidden='true'
    >
      <path d='M880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zm-40 728H184V184h656v656z'></path>
      <path d='M184 848V184h656v656H184zm240-424h176v176H424z'></path>
    </svg>
  </span>
);

const Help = () => {
  usePageTitle('Divemap - Help & User Guide');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'start';
  const screens = useBreakpoint();

  const handleTabChange = key => {
    if (key) {
      setSearchParams({ tab: Array.isArray(key) ? key[0] : key });
    }
  };

  const FeatureCard = ({ icon, title, description, tags = [], link }) => (
    <Card
      className='h-full hover:shadow-md transition-shadow cursor-pointer'
      size='small'
      onClick={() => link && window.location.assign(link)}
    >
      <Space orientation='vertical' className='w-full'>
        <Space className='mb-2'>
          {React.cloneElement(icon, { style: { fontSize: '24px', color: '#1890ff' } })}
          <Text strong style={{ fontSize: '16px' }}>
            {title}
          </Text>
        </Space>
        {tags.length > 0 && (
          <Space size={[0, 8]} wrap>
            {tags.map(tag => (
              <Tag key={tag} color='blue'>
                {tag}
              </Tag>
            ))}
          </Space>
        )}
        <Paragraph type='secondary' className='mb-0 text-sm'>
          {description}
        </Paragraph>
      </Space>
    </Card>
  );

  const StepGuide = ({ steps }) => (
    <div className='bg-gray-50 p-6 rounded-lg border border-gray-100 h-full'>
      {screens.xs ? (
        <MobileSteps
          orientation='vertical'
          items={steps.map((step, index) => ({
            title: <Text strong>{step.title}</Text>,
            description: <Text type='secondary'>{step.description}</Text>,
            status: 'wait',
            icon: (
              <div className='bg-white border-2 border-blue-500 text-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold'>
                {index + 1}
              </div>
            ),
          }))}
        />
      ) : (
        <Steps
          orientation='vertical'
          size='small'
          current={-1}
          items={steps.map((step, index) => ({
            title: <Text strong>{step.title}</Text>,
            content: <Text type='secondary'>{step.description}</Text>,
            icon: (
              <div className='bg-white border-2 border-blue-500 text-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold'>
                {index + 1}
              </div>
            ),
          }))}
        />
      )}
    </div>
  );

  const items = [
    {
      key: 'start',
      label: (
        <span>
          <RocketOutlined /> Getting Started
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <div className='text-center max-w-4xl mx-auto mb-8'>
            <Title level={2}>Welcome to Divemap</Title>
            <Paragraph className='text-lg text-gray-600'>
              The all-in-one platform for scuba divers to discover sites, log adventures, plan
              technical dives, and connect with the community.
            </Paragraph>
          </div>

          <Row gutter={[32, 32]}>
            <Col xs={24} lg={12}>
              <Card
                title='Quick Start Guide'
                variant='borderless'
                className='h-full bg-blue-50 shadow-sm'
              >
                <StepGuide
                  steps={[
                    {
                      title: 'Create an Account',
                      description: (
                        <span>
                          <Link to='/register'>Sign up</Link> or use Google Login to sync your data
                          across devices.
                        </span>
                      ),
                    },
                    {
                      title: 'Complete Your Profile',
                      description: (
                        <span>
                          Add your certifications and diving stats in your{' '}
                          <Link to='/profile'>Profile</Link>.
                        </span>
                      ),
                    },
                    {
                      title: 'Explore the Map',
                      description: (
                        <span>
                          Use the <Link to='/map'>global map</Link> to find dive sites and centers
                          near you.
                        </span>
                      ),
                    },
                    {
                      title: 'Log Your First Dive',
                      description: (
                        <span>
                          Manually <Link to='/dives/create'>log a dive</Link> or import from
                          Subsurface XML.
                        </span>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Space orientation='vertical' size='large' className='w-full'>
                <Card
                  title={
                    <Space>
                      <MobileOutlined /> Install as App (PWA)
                    </Space>
                  }
                  variant='borderless'
                  className='shadow-sm'
                >
                  <Paragraph>
                    Divemap is a Progressive Web App (PWA). You can install it on your device for a
                    native-like experience and offline access.
                  </Paragraph>
                  <div className='space-y-3 mt-4'>
                    {[
                      {
                        key: 'android',
                        content: (
                          <span>
                            <strong>Android (Chrome):</strong> Tap the menu <Text code>⋮</Text> and
                            select <Text strong>Install app</Text> or{' '}
                            <Text strong>Add to Home screen</Text>.
                          </span>
                        ),
                      },
                      {
                        key: 'ios',
                        content: (
                          <span>
                            <strong>iOS (Safari):</strong> Tap the Share button{' '}
                            <span role='img' aria-label='share'>
                              ⎋
                            </span>{' '}
                            and select <Text strong>Add to Home Screen</Text>.
                          </span>
                        ),
                      },
                      {
                        key: 'desktop',
                        content: (
                          <span>
                            <strong>Desktop (Chrome/Edge):</strong> Click the install icon{' '}
                            <DownloadOutlined /> in the address bar.
                          </span>
                        ),
                      },
                    ].map(item => (
                      <div
                        key={item.key}
                        className='text-sm py-1 border-b border-gray-50 last:border-0'
                      >
                        {item.content}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card
                  title={
                    <Space>
                      <BellOutlined /> Notifications
                    </Space>
                  }
                  variant='borderless'
                  className='shadow-sm'
                >
                  <Paragraph>
                    Never miss an update. Configure your preferences to receive alerts for:
                  </Paragraph>
                  <Space wrap className='mb-4'>
                    <Tag icon={<TeamOutlined />} color='cyan'>
                      New Buddies
                    </Tag>
                    <Tag icon={<EnvironmentOutlined />} color='green'>
                      New Sites
                    </Tag>
                    <Tag icon={<ToolOutlined />} color='orange'>
                      System Updates
                    </Tag>
                  </Space>
                  <Paragraph className='mb-0'>
                    Manage your alert settings in{' '}
                    <Link to='/notifications/preferences'>Notification Preferences</Link>.
                  </Paragraph>
                </Card>
              </Space>
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'map',
      label: (
        <span>
          <GlobalOutlined /> Global Map
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={14}>
              <div className='rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                <Image
                  src='/help-screenshots/map-suitability.png'
                  alt='Map Interface with Wind & Suitability'
                  fallback='https://placehold.co/800x500?text=Map+Suitability'
                />
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <Title level={3}>Interactive Global Map</Title>
              <Paragraph>
                Navigate the underwater world with our comprehensive map. Access it via the{' '}
                <Link to='/map'>Map</Link> link.
              </Paragraph>

              <Divider orientation='left'>
                <LayersOutlined /> Map Layers
              </Divider>
              <Paragraph>
                Customize your view using the layer switcher (top-right corner).
              </Paragraph>
              <ul className='list-disc pl-5 space-y-2 text-gray-700'>
                <li>
                  <strong>Street:</strong> Standard vector map, good for navigation.
                </li>
                <li>
                  <strong>Satellite:</strong> Aerial imagery to spot reef structures.
                </li>
                <li>
                  <strong>Terrain:</strong> Topographic view for land elevation context.
                </li>
                <li>
                  <strong>Navigation:</strong> Specialized charts (where available).
                </li>
              </ul>

              <Divider orientation='left'>
                <CloudOutlined /> Weather & Suitability
              </Divider>
              <Paragraph>Plan your dives safely with real-time weather integration.</Paragraph>
              <ul className='list-disc pl-5 space-y-2 text-gray-700'>
                <li>
                  <strong>Enable Overlay:</strong> Click the <Text strong>Wind</Text> toggle on the
                  map controls.
                </li>
                <li>
                  <strong>Suitability Recommendations:</strong> Dive sites are color-coded based on
                  wind conditions:
                  <ul className='list-circle pl-5 mt-1'>
                    <li>
                      <span className='text-green-600 font-bold'>Green</span>: Good conditions.
                    </li>
                    <li>
                      <span className='text-orange-500 font-bold'>Orange</span>: Caution advised.
                    </li>
                    <li>
                      <span className='text-red-500 font-bold'>Red</span>: Difficult/Avoid.
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Forecast Slider:</strong> Drag the time slider at the bottom to see wind
                  predictions up to 24 hours ahead.
                </li>
              </ul>
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'directories',
      label: (
        <span>
          <AppstoreOutlined /> Directories
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <Title level={2}>Discover the World of Diving</Title>
          <Paragraph className='text-lg text-gray-600'>
            Explore our curated databases of sites, centers, and organized trips.
          </Paragraph>

          {/* Dive Sites Section */}
          <Card
            id='sites'
            title={
              <Space>
                <EnvironmentOutlined /> <Link to='/dive-sites'>Dive Sites</Link>
              </Space>
            }
            variant='borderless'
            className='shadow-sm'
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} md={10}>
                <Image
                  src='/help-screenshots/dive-sites-list.png'
                  className='rounded-lg border border-gray-100'
                />
              </Col>
              <Col xs={24} md={14}>
                <Paragraph>
                  Access a global database of dive locations. Each site features detailed
                  descriptions, community ratings, and user-submitted photos.
                </Paragraph>
                <div className='space-y-2 mt-4'>
                  {[
                    'Unified Search: Search by name, country, or region instantly.',
                    "Quick Filters: One-click filtering for 'Wreck', 'Reef', 'Boat', or 'Shore' dives.",
                    'Map Toggle: Switch between list view and map view to explore geographically.',
                    'Community Verdict: See at a glance if a site is recommended by other divers.',
                  ].map((item, i) => (
                    <div key={i} className='flex items-start text-sm'>
                      <CheckCircleOutlined className='text-green-500 mr-2 mt-1' /> {item}
                    </div>
                  ))}
                </div>
                <Button type='primary' className='mt-4' href='/dive-sites'>
                  Browse Dive Sites
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Diving Centers Section */}
          <Card
            id='centers'
            title={
              <Space>
                <ShopOutlined /> <Link to='/diving-centers'>Diving Centers</Link>
              </Space>
            }
            variant='borderless'
            className='shadow-sm'
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} md={14}>
                <Paragraph>
                  Find professional dive operators for your next adventure. Connect with centers
                  that offer the gear, courses, and trips you need.
                </Paragraph>
                <div className='space-y-2 mt-4'>
                  {[
                    'Rating Filter: Find top-rated centers with the minimum rating slider.',
                    "Services: View offered services like 'Nitrox', 'Trimix', or 'Gear Rental'.",
                    'Affiliations: See associated training agencies (PADI, SSI, etc.).',
                  ].map((item, i) => (
                    <div key={i} className='flex items-start text-sm'>
                      <CheckCircleOutlined className='text-blue-500 mr-2 mt-1' /> {item}
                    </div>
                  ))}
                </div>

                <Divider dashed />

                <div className='bg-blue-50 p-4 rounded-lg'>
                  <Title level={5} className='mb-2'>
                    For Business Owners
                  </Title>
                  <Paragraph className='text-sm mb-2'>
                    Do you own a diving center? Take control of your listing!
                  </Paragraph>
                  <div className='space-y-2'>
                    {[
                      'Claim Ownership: Click "Claim Ownership" on your center\'s page.',
                      'Manage Services: Update your contact info, services, and rental gear.',
                      'Promote Trips: Add upcoming dive trips to the global calendar.',
                    ].map((item, i) => (
                      <div key={i} className='flex items-start text-xs'>
                        <CheckCircleOutlined className='text-blue-500 mr-2 mt-1' /> {item}
                      </div>
                    ))}
                  </div>
                </div>

                <Button type='primary' className='mt-4' href='/diving-centers'>
                  Find Centers
                </Button>
              </Col>
              <Col xs={24} md={10}>
                <Space orientation='vertical' size='middle' className='w-full'>
                  <Image
                    src='/help-screenshots/diving-centers-list.png'
                    className='rounded-lg border border-gray-100'
                  />
                  <div className='rounded-lg overflow-hidden border border-gray-200'>
                    <Image
                      src='/help-screenshots/diving-center-claim.png'
                      alt='Diving Center Claim Button'
                      fallback='https://placehold.co/800x200?text=Claim+Center'
                    />
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Dive Trips Section */}
          <Card
            id='trips'
            title={
              <Space>
                <CalendarOutlined /> <Link to='/dive-trips'>Dive Trips</Link>
              </Space>
            }
            variant='borderless'
            className='shadow-sm'
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} md={10}>
                <Image
                  src='/help-screenshots/dive-trips-list.png'
                  className='rounded-lg border border-gray-100'
                />
              </Col>
              <Col xs={24} md={14}>
                <Paragraph>
                  Looking for an organized excursion? Browse upcoming trips aggregated from
                  newsletters and centers.
                </Paragraph>
                <div className='space-y-2 mt-4'>
                  {[
                    'Advanced Search: Filter by price range, duration, and difficulty.',
                    'Calendar View: See trips scheduled for specific dates.',
                    "Status: Identify 'Scheduled' vs 'Confirmed' trips easily.",
                    'Newsletter Integration: Automatically parsed from diving center newsletters.',
                  ].map((item, i) => (
                    <div key={i} className='flex items-start text-sm'>
                      <CheckCircleOutlined className='text-purple-500 mr-2 mt-1' /> {item}
                    </div>
                  ))}
                </div>
                <Button type='primary' className='mt-4' href='/dive-trips'>
                  View Upcoming Trips
                </Button>
              </Col>
            </Row>
          </Card>
        </Space>
      ),
    },
    {
      key: 'log',
      label: (
        <span>
          <BookOutlined /> Log & Import
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={10}>
              <Title level={3}>Deep Dive Analysis</Title>
              <Paragraph>
                Divemap provides professional-grade telemetry analysis for every logged dive.
              </Paragraph>

              <Alert
                message='Understanding the Data'
                type='info'
                className='mb-4'
                description={
                  <ul className='list-disc pl-5 mb-0'>
                    <li>
                      <strong>Dive:</strong> Your specific event log at a site (The "When" &
                      "What").
                    </li>
                    <li>
                      <strong>Telemetry:</strong> High-frequency data from your dive computer
                      (Depth, Temp, Gas).
                    </li>
                  </ul>
                }
              />

              <Card size='small' title='Chart Features' className='mb-4'>
                <ul className='list-none pl-0 space-y-2'>
                  {[
                    {
                      title: 'Profile Graph',
                      desc: 'Interactive depth vs. time chart.',
                    },
                    {
                      title: 'Temperature',
                      desc: 'Secondary axis overlay for water temp.',
                    },
                    {
                      title: 'Decompression',
                      desc: 'Visualizes ceiling depth and stop times.',
                    },
                    {
                      title: 'Gas Switches',
                      desc: 'Automatic vertical markers for gas changes.',
                    },
                  ].map((item, idx) => (
                    <li key={idx} className='flex items-start'>
                      <CheckCircleOutlined className='text-blue-500 mr-2 mt-1' />
                      <div>
                        <Text strong>{item.title}</Text>
                        <br />
                        <Text type='secondary'>{item.desc}</Text>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              <Paragraph>
                <strong>How to use:</strong> Go to any <Link to='/dives'>Dive Log</Link>, click{' '}
                <strong>Details</strong>, then select the <strong>Profile</strong> tab.
              </Paragraph>
            </Col>
            <Col xs={24} lg={14}>
              <div className='rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                <Image
                  src='/help-screenshots/dive-log-profile.png'
                  alt='Dive Profile Chart Analysis'
                  fallback='https://placehold.co/800x500?text=Dive+Profile+Chart'
                />
              </div>
            </Col>
          </Row>

          <Divider />

          <Row gutter={[32, 32]}>
            <Col xs={24}>
              <Title level={3}>
                <ImportOutlined /> Import Dives
              </Title>
              <Paragraph>
                Migrating from another platform? Import your entire logbook in seconds.
              </Paragraph>
              <Tabs
                defaultActiveKey='subsurface'
                size='small'
                className='bg-gray-50/50 rounded-lg p-2 border border-gray-100'
                items={[
                  {
                    key: 'subsurface',
                    label: 'Subsurface',
                    children: (
                      <div className='py-2 px-1'>
                        <Paragraph className='text-xs text-gray-500 mb-4 italic'>
                          The most comprehensive import method.
                        </Paragraph>
                        <Steps
                          orientation='vertical'
                          size='small'
                          current={-1}
                          items={[
                            {
                              title: 'Export XML',
                              content: 'In Subsurface, go to File > Export > XML.',
                            },
                            {
                              title: 'Upload',
                              content: (
                                <span>
                                  Go to <Link to='/dives'>My Dives</Link> and click 'Import Dives'.
                                </span>
                              ),
                            },
                            {
                              title: 'Review',
                              content: "We'll match sites automatically. Confirm and save.",
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'myssi',
                    label: 'MySSI',
                    children: (
                      <div className='py-2 px-1'>
                        <Steps
                          orientation='vertical'
                          size='small'
                          current={-1}
                          items={[
                            {
                              title: 'Log in to MySSI',
                              content: 'Navigate to Personal Data > Logbook & Sites > Logbook.',
                            },
                            {
                              title: 'Find Export',
                              content: (
                                <div className='space-y-2 mt-1'>
                                  <Text type='secondary'>
                                    In Logbook – Overview, find the export options.
                                  </Text>
                                  <Image
                                    src='/help-screenshots/myssi-export-step1.png'
                                    className='rounded border shadow-sm'
                                    placeholder={true}
                                  />
                                </div>
                              ),
                            },
                            {
                              title: 'Export CSV',
                              content: (
                                <div className='space-y-2 mt-1'>
                                  <Text type='secondary'>
                                    Click the CSV button to download your logbook.
                                  </Text>
                                  <Image
                                    src='/help-screenshots/myssi-export-step2.png'
                                    className='rounded border shadow-sm'
                                    placeholder={true}
                                  />
                                </div>
                              ),
                            },
                            {
                              title: 'Upload',
                              content: (
                                <span>
                                  Import the CSV file in <Link to='/dives'>My Dives</Link> &gt;
                                  Import Dives.
                                </span>
                              ),
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'garmin',
                    label: 'Garmin',
                    children: (
                      <div className='py-2 px-1'>
                        <Steps
                          orientation='vertical'
                          size='small'
                          current={-1}
                          items={[
                            {
                              title: 'Garmin Connect',
                              content: 'Sign into Garmin Connect on a web browser.',
                            },
                            {
                              title: 'Select Activity',
                              content: 'Go to Activities > All Activities and click your dive.',
                            },
                            {
                              title: 'Export Original',
                              content: (
                                <span>
                                  Click the <strong>Settings (gear icon)</strong> &gt;{' '}
                                  <strong>Export Original</strong> to get the .fit file.
                                </span>
                              ),
                            },
                            {
                              title: 'Upload',
                              content:
                                'Upload the .fit file to Divemap to automatically see your profile.',
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'suunto',
                    label: 'Suunto',
                    children: (
                      <div className='py-2 px-1'>
                        <Steps
                          orientation='vertical'
                          size='small'
                          current={-1}
                          items={[
                            {
                              title: 'Export JSON',
                              content:
                                'Export your logbook from Suunto app or DM5 software in JSON format.',
                            },
                            {
                              title: 'Upload',
                              content: (
                                <span>
                                  Go to <Link to='/dives'>My Dives</Link> and click 'Import Dives'.
                                </span>
                              ),
                            },
                            {
                              title: 'Review',
                              content: 'Verify your telemetry and dive details before saving.',
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'media_routes',
      label: (
        <span>
          <CompassOutlined /> Sites & Media
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={10}>
              <Title level={3}>Dive Sites</Title>
              <Paragraph>
                Dive sites are the backbone of Divemap. They represent the fixed geographic
                locations where your adventures happen.
              </Paragraph>
              <Alert
                message='Contribution'
                type='success'
                showIcon
                description='Divemap is community-driven. You can contribute by adding new sites or reviewing existing ones.'
              />
              <Paragraph className='mt-4'>
                <strong>Features:</strong>
                <ul className='list-disc pl-5 space-y-1 mt-2'>
                  <li>Detailed maps with depth contours (where available).</li>
                  <li>Real-time weather and wind suitability.</li>
                  <li>Community reviews and sightings.</li>
                </ul>
              </Paragraph>
            </Col>
            <Col xs={24} lg={14}>
              <div className='rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                <Image
                  src='/help-screenshots/dive-sites-map-view.png'
                  alt='Dive Site Detailed Map View'
                  fallback='https://placehold.co/800x500?text=Dive+Sites+Map'
                />
              </div>
            </Col>
          </Row>

          <Divider />

          <Row gutter={[32, 32]}>
            <Col xs={24} lg={14}>
              <div className='rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                <Image
                  src='/help-screenshots/media-gallery-lightbox.png'
                  alt='Media Gallery Lightbox'
                  fallback='https://placehold.co/800x500?text=Media+Gallery'
                />
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <Title level={3}>Media Gallery</Title>
              <Paragraph>Relive your dives with our immersive media gallery.</Paragraph>
              <ul className='list-disc pl-5 space-y-2 text-gray-700'>
                <li>
                  <strong>Lightbox View:</strong> Full-screen browsing of photos and videos.
                </li>
                <li>
                  <strong>Deep Linking:</strong> Share direct links to specific photos or videos.
                </li>
                <li>
                  <strong>Reordering:</strong> Organize your memories exactly how you want them.
                </li>
              </ul>
              <Paragraph className='mt-4 text-xs text-gray-500'>
                Photos are automatically associated with the dive site to help other divers know
                what to expect.
              </Paragraph>
            </Col>
          </Row>

          <Divider />

          <Row gutter={[32, 32]}>
            <Col xs={24}>
              <Title level={3}>
                <CompassOutlined /> Dive Routes
              </Title>
              <Paragraph>Visualize your underwater journey with multi-segment routes.</Paragraph>

              <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                  <div className='rounded-lg overflow-hidden border border-gray-100 shadow-sm'>
                    <Image
                      src='/help-screenshots/dive-route-details.png'
                      alt='View Detailed Dive Route'
                    />
                    <div className='bg-gray-50 p-2 text-center text-xs text-gray-500 border-t'>
                      Explore routes with swim, walk, and scuba segments + points of interest.
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div className='rounded-lg overflow-hidden border border-gray-100 shadow-sm'>
                    <Image
                      src='/help-screenshots/dive-route-drawing.png'
                      alt='Dive Route Drawing Interface'
                    />
                    <div className='bg-gray-50 p-2 text-center text-xs text-gray-500 border-t'>
                      Intuitive drawing tools to map your own dives.
                    </div>
                  </div>
                </Col>
              </Row>

              <Paragraph type='secondary' className='mt-4'>
                On any Dive Site page, click <strong>Draw Route</strong> to map your path, or browse
                community routes to plan your next dive.
              </Paragraph>
              <div className='space-y-2 mt-4'>
                {[
                  'Mixed Segments: Walk (shore entry), Swim (surface), or Scuba (underwater).',
                  'Interactive Map: View compass bearings and distances.',
                  'Points of Interest: Add markers for caves, wrecks, or specific marine life.',
                  'Sharing & Export: Share with friends or export to GPX/KML formats.',
                ].map((item, i) => (
                  <div key={i} className='flex items-start text-sm'>
                    <CheckCircleOutlined className='text-blue-500 mr-2 mt-1' /> {item}
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'tools',
      label: (
        <span>
          <ToolOutlined /> Tools & Planning
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={14}>
              <div className='rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                <Image
                  src='/help-screenshots/calculators-menu.png'
                  alt='Diving Calculators Interface'
                  fallback='https://placehold.co/800x500?text=Calculators'
                />
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <Title level={3}>Planning Suite</Title>
              <Paragraph>
                Access our <Link to='/resources/tools'>Technical Diving Calculators</Link> for
                mission-critical planning.
              </Paragraph>
              <Alert
                message='Safety First'
                description='These tools utilize a high-precision physics engine but should always be verified against your dive computer and standard tables.'
                type='warning'
                showIcon
                className='mb-6'
              />
              <Row gutter={[16, 16]}>
                {[
                  {
                    name: 'MOD / Best Mix',
                    desc: 'Calculate Maximum Operating Depth and find the optimal gas mix.',
                    link: '/resources/tools',
                  },
                  {
                    name: 'Min Gas (Rock Bottom)',
                    desc: 'Calculate emergency reserve gas needs for safe ascent.',
                    link: '/resources/tools',
                  },
                  {
                    name: 'SAC Rate',
                    desc: 'Track and calculate your Surface Air Consumption rate.',
                    link: '/resources/tools',
                  },
                  {
                    name: 'Weight Calculator',
                    desc: 'Estimate required weight based on exposure protection and tank type.',
                    link: '/resources/tools',
                  },
                ].map((item, idx) => (
                  <Col span={24} key={idx}>
                    <Link
                      to={item.link}
                      className='block p-3 border rounded hover:bg-gray-50 transition-colors'
                    >
                      <Space>
                        <CalculatorOutlined className='text-blue-500' />
                        <Text strong>{item.name}</Text>
                      </Space>
                      <Paragraph type='secondary' className='mb-0 text-xs mt-1 ml-6'>
                        {item.desc}
                      </Paragraph>
                    </Link>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'community',
      label: (
        <span>
          <TeamOutlined /> Community
        </span>
      ),
      children: (
        <Space orientation='vertical' size='large' className='w-full py-4'>
          <Row gutter={[32, 32]}>
            <Col xs={24} lg={10}>
              <Title level={3}>Connect & Share</Title>
              <Paragraph>
                Build your network. Find buddies, verify certifications, and share your passion.
              </Paragraph>

              <Card title='Dive Buddies' size='small' className='mb-4'>
                <Paragraph>Tag friends in your logs to create a shared history.</Paragraph>
                <ol className='list-decimal pl-5 space-y-1'>
                  <li>
                    Go to{' '}
                    <strong>
                      <Link to='/profile'>Profile</Link>
                    </strong>{' '}
                    to set your visibility.
                  </li>
                  <li>
                    Use the <strong>User Search</strong> to find divers.
                  </li>
                  <li>Send a buddy request to connect.</li>
                </ol>
              </Card>

              <Card title='Share Your Adventures' size='small' className='mb-4'>
                <Paragraph>Share your dives, routes, and favorite sites on social media.</Paragraph>
                <Paragraph type='secondary' className='text-sm'>
                  Look for the <strong>Share</strong> button on any detail page to post to Facebook,
                  Twitter, WhatsApp, and more.
                </Paragraph>
              </Card>

              <Card
                title={<Link to='/profile'>Public Profile</Link>}
                size='small'
                extra={<Link to='/profile'>Edit</Link>}
              >
                <Paragraph>Your profile showcases your experience level.</Paragraph>
                <ul className='list-disc pl-5 space-y-1'>
                  <li>Total dives & hours.</li>
                  <li>Verified Certifications.</li>
                  <li>Contribution stats (Sites created, Reviews).</li>
                </ul>
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <div className='rounded-xl overflow-hidden shadow-lg border border-gray-200'>
                <Image
                  src='/help-screenshots/user-profile-public.png'
                  alt='Public User Profile Example'
                  fallback='https://placehold.co/800x500?text=User+Profile'
                />
              </div>
            </Col>
          </Row>
        </Space>
      ),
    },
  ];

  return (
    <div className='min-h-screen bg-gray-50 pt-20 pb-12'>
      <div className='max-w-6xl mx-auto px-2 sm:px-4'>
        <div className='text-center mb-10'>
          <Title level={1} className='mb-2'>
            Help & Documentation
          </Title>
          <Paragraph className='text-lg text-gray-500 max-w-2xl mx-auto'>
            Master the Divemap platform. Comprehensive guides for all features and tools.
          </Paragraph>
        </div>

        {screens.xs ? (
          <div className='bg-white rounded-xl shadow-sm overflow-hidden'>
            <Collapse accordion defaultActiveKey={activeTab} onChange={handleTabChange}>
              {items.map(item => (
                <Collapse.Panel title={item.label} key={item.key}>
                  <div className='p-4'>{item.children}</div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={items}
            size='large'
            type='line'
            className='bg-white rounded-xl shadow-sm p-6'
            prose
            prose-blue
            dark:prose-invert
            max-w-none
          />
        )}

        <Divider />
        <div className='text-center'>
          <Space
            orientation={screens.xs ? 'vertical' : 'horizontal'}
            separator={!screens.xs && <Divider orientation='vertical' />}
            size={screens.xs ? 'small' : 'middle'}
          >
            <Button type='link' href='/changelog' icon={<RocketOutlined />}>
              View Latest Updates
            </Button>
            <Button
              type='link'
              href='https://github.com/kargig/divemap'
              target='_blank'
              icon={<GithubOutlined />}
            >
              Project on GitHub
            </Button>
          </Space>
          <Paragraph type='secondary' className='mt-4 text-xs'>
            Divemap is an open-source project. Last updated: January 22, 2026.
          </Paragraph>
        </div>
      </div>
    </div>
  );
};

export default Help;
