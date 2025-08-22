import {
  Shield,
  Lock,
  Eye,
  Download,
  Users,
  Database,
  Calendar,
  AlertTriangle,
  Map,
  Cookie,
  Server,
  Mail,
  UserCheck,
} from 'lucide-react';

const Privacy = () => {
  return (
    <div className='max-w-4xl mx-auto'>
      <div className='bg-white rounded-lg shadow-lg p-8'>
        <div className='text-center mb-8'>
          <div className='flex justify-center items-center mb-4'>
            <h1 className='text-4xl font-bold text-gray-900'>Privacy Policy</h1>
          </div>
          <p className='text-xl text-gray-600'>
            How we protect and handle your personal information and data on Divemap
          </p>
          <p className='text-sm text-gray-500 mt-2'>
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Overview Section */}
        <section className='mb-8'>
          <div className='flex items-start mb-6'>
            <Shield className='h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0' />
            <div>
              <h2 className='text-lg font-semibold text-blue-900 mb-2'>Your Privacy Matters</h2>
              <p className='text-blue-800'>
                We are committed to protecting your personal information. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use
                our platform. By using Divemap, you agree to the collection and use of information
                in accordance with this policy. We will not use or share your information with
                anyone except as described in this Privacy Policy.
              </p>
            </div>
          </div>

          <div className='bg-blue-50 p-6 rounded-lg'>
            <h3 className='text-lg font-semibold text-blue-900 mb-3'>Data Protection Overview</h3>
            <p className='text-blue-800 mb-4'>
              The following gives a simple overview of what happens to your personal information
              when you visit our website. Personal information is any data with which you could be
              personally identified.
            </p>
            <div className='grid md:grid-cols-2 gap-4'>
              <div>
                <h4 className='font-semibold text-blue-900 mb-2'>Who is responsible?</h4>
                <p className='text-blue-700 text-sm'>
                  The data collected on this website are processed by the website operator. Contact
                  details can be found in the website&apos;s legal notice.
                </p>
              </div>
              <div>
                <h4 className='font-semibold text-blue-900 mb-2'>How do we collect data?</h4>
                <p className='text-blue-700 text-sm'>
                  Some data are collected when you provide it to us. Other data are collected
                  automatically by our IT systems when you visit the website.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Information We Collect */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Eye className='h-6 w-6 text-blue-600 mr-3' />
            Information We Collect
          </h2>
          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>Personal Information</h3>
              <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4'>
                <li>Name, username and contact information</li>
                <li>Email address and authentication details</li>
                <li>Profile information and preferences</li>
                <li>Diving certifications and experience</li>
              </ul>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>Usage Data</h3>
              <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4'>
                <li>Platform usage patterns</li>
                <li>Pages visited and features used</li>
                <li>Search queries and interactions</li>
                <li>Device and browser information</li>
              </ul>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>User-Generated Content</h3>
              <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4'>
                <li>Dive site reviews and ratings</li>
                <li>Dive logs and trip reports</li>
                <li>Photos and media uploads</li>
                <li>Comments and community contributions</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How We Use Information */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Database className='h-6 w-6 text-blue-600 mr-3' />
            How We Use Your Information
          </h2>
          <p className='text-gray-600 mb-4'>We use the information we collect to:</p>
          <ul className='list-disc list-inside space-y-2 text-gray-600 ml-4'>
            <li>Provide and maintain our diving platform services</li>
            <li>Process and manage your account and subscriptions</li>
            <li>Enable you to create and share dive content</li>
            <li>Improve our services and user experience</li>
            <li>Send important service updates and notifications</li>
            <li>Ensure platform security and prevent abuse</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        {/* Data Security */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Lock className='h-6 w-6 text-blue-600 mr-3' />
            Data Security and Protection
          </h2>
          <div className='bg-green-50 p-6 rounded-lg mb-6'>
            <h3 className='text-lg font-semibold text-green-900 mb-2'>Our Commitment</h3>
            <p className='text-green-800'>
              We implement industry-standard security measures to protect your personal information.
              We are committed to keeping your personal information private and will not sell,
              trade, or otherwise transfer your personal data to third parties for marketing
              purposes.
            </p>
          </div>
          <div className='mt-4 space-y-3'>
            <h3 className='text-lg font-semibold text-gray-800'>Security Measures</h3>
            <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4'>
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure data centers and infrastructure</li>
              <li>Employee training on data protection</li>
            </ul>
          </div>
        </section>

        {/* Data Sharing */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Users className='h-6 w-6 text-blue-600 mr-3' />
            Data Sharing and Third Parties
          </h2>
          <div className='bg-yellow-50 p-6 rounded-lg mb-6'>
            <h3 className='text-lg font-semibold text-yellow-900 mb-2'>No Data Sales</h3>
            <p className='text-yellow-800'>
              We do not sell, rent, or trade your personal information to third parties. We may
              share your information only in these limited circumstances:
            </p>
          </div>
          <ul className='list-disc list-inside space-y-2 text-gray-600 ml-4 mt-4'>
            <li>
              With service providers who assist in platform operation (under strict confidentiality
              agreements)
            </li>
            <li>When required by law or legal process</li>
            <li>To protect our rights, property, or safety</li>
            <li>With your explicit consent for specific purposes</li>
          </ul>
        </section>

        {/* Data Export */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Download className='h-6 w-6 text-blue-600 mr-3' />
            Data Export and Portability
          </h2>
          <div className='bg-blue-50 p-6 rounded-lg mb-6'>
            <h3 className='text-lg font-semibold text-blue-900 mb-2'>Your Data, Your Control</h3>
            <p className='text-blue-800'>
              You have the right to access, download, and export all your personal data, dive
              records, and user-generated content at any time.
            </p>
          </div>
          <div className='mt-4'>
            <h3 className='text-lg font-semibold text-gray-800 mb-2'>Export Features</h3>
            <p className='text-gray-600 mb-3'>We provide tools and features that allow you to:</p>
            <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4'>
              <li>Download your dive data in multiple formats</li>
              <li>Export your profile and account information</li>
              <li>Access all your uploaded content and media</li>
              <li>Transfer your data to other platforms</li>
            </ul>
          </div>
        </section>

        {/* User Rights */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <UserCheck className='h-6 w-6 text-blue-600 mr-3' />
            Your Rights and Choices
          </h2>
          <p className='text-gray-600 mb-4'>
            Under applicable data protection laws, you have several rights regarding your personal
            information:
          </p>
          <div className='grid md:grid-cols-2 gap-4'>
            <div className='space-y-3'>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Access:</strong> View all personal data we hold about you
                </span>
              </div>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Correction:</strong> Update or correct inaccurate information
                </span>
              </div>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Deletion:</strong> Request removal of your personal data
                </span>
              </div>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Portability:</strong> Export your data in a machine-readable format
                </span>
              </div>
            </div>
            <div className='space-y-3'>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Objection:</strong> Object to certain types of processing
                </span>
              </div>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Withdrawal:</strong> Revoke consent for data processing
                </span>
              </div>
              <div className='flex items-start'>
                <span className='text-blue-600 mr-2'>•</span>
                <span>
                  <strong>Complaint:</strong> Lodge complaints with supervisory authorities
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Data Retention */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Calendar className='h-6 w-6 text-blue-600 mr-3' />
            Data Retention
          </h2>
          <p className='text-gray-600'>
            We retain your personal information only for as long as necessary to provide our
            services and fulfill the purposes outlined in this policy. When you delete your account,
            we will remove your personal data within 30 days, except where we need to retain certain
            information for legal, regulatory, or legitimate business purposes.
          </p>
        </section>

        {/* Cookies and Tracking */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Cookie className='h-6 w-6 text-blue-600 mr-3' />
            Cookies and Tracking Technologies
          </h2>
          <p className='text-gray-600 mb-4'>
            Our website uses cookies and similar technologies to enhance your experience and provide
            essential functionality.
          </p>
          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>Essential Cookies</h3>
              <p className='text-gray-600'>
                These cookies are necessary for the website to function properly. They enable basic
                functions like page navigation, access to secure areas, and user authentication.
              </p>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>Functional Cookies</h3>
              <p className='text-gray-600'>
                These cookies remember your preferences and settings to provide enhanced
                functionality and personalization.
              </p>
            </div>
            <div>
              <h3 className='text-lg font-semibold text-gray-800 mb-2'>Analytics Cookies</h3>
              <p className='text-gray-600'>
                We use analytics cookies to understand how visitors interact with our website,
                helping us improve our services and user experience.
              </p>
            </div>
          </div>
        </section>

        {/* Server Logs */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Server className='h-6 w-6 text-blue-600 mr-3' />
            Server Log Files
          </h2>
          <p className='text-gray-600 mb-4'>
            Our web servers automatically collect and store information that your browser transmits
            to us in server log files. This may include any or all of the following:
          </p>
          <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4'>
            <li>Browser type and version</li>
            <li>Operating system used</li>
            <li>Referrer URL</li>
            <li>IP and Host name of the accessing computer</li>
            <li>Time of the server request</li>
          </ul>
          <p className='text-gray-600 mt-4'>
            This data is not combined with data from other sources and is used solely for technical
            administration and security purposes.
          </p>
        </section>

        {/* Cloudflare Turnstile */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Shield className='h-6 w-6 text-blue-600 mr-3' />
            Cloudflare Turnstile
          </h2>
          <p className='text-gray-600 mb-4'>
            We use Cloudflare Turnstile on our website to protect against automated bots and spam.
            This service is provided by Cloudflare, Inc.
          </p>
          <p className='text-gray-600 mb-4'>
            Turnstile analyzes various factors to determine if a visitor is human, including:
          </p>
          <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4 mb-4'>
            <li>Browser behavior and interaction patterns</li>
            <li>Device characteristics and network information</li>
            <li>Previous interaction history with Cloudflare services</li>
          </ul>
          <p className='text-gray-600'>
            The data collected during this analysis is processed by Cloudflare in accordance with
            their privacy policy. We do not have access to the specific data collected by Turnstile.
          </p>
        </section>

        {/* OpenLayers Maps */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Map className='h-6 w-6 text-blue-600 mr-3' />
            OpenLayers Mapping Service
          </h2>
          <p className='text-gray-600 mb-4'>
            Our website uses OpenLayers, an open-source mapping library, to provide interactive maps
            and location services. OpenLayers is developed and maintained by the OpenLayers
            community.
          </p>
          <p className='text-gray-600 mb-4'>
            When you use our mapping features, the following information may be processed:
          </p>
          <ul className='list-disc list-inside space-y-1 text-gray-600 ml-4 mb-4'>
            <li>Map tile requests and viewport information</li>
            <li>Location data you choose to share (dive sites, coordinates)</li>
            <li>Map interaction data (zoom levels, pan positions)</li>
          </ul>
          <p className='text-gray-600'>
            OpenLayers is a client-side library that runs in your browser. We do not share your
            location data with third-party mapping services unless you explicitly choose to do so.
          </p>
        </section>

        {/* No Advertising */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <AlertTriangle className='h-6 w-6 text-blue-600 mr-3' />
            No Advertising or Marketing
          </h2>
          <div className='bg-green-50 p-6 rounded-lg'>
            <p className='text-green-800'>
              <strong>Important:</strong> Divemap does not display any advertising on our website.
              We do not use your personal information for marketing purposes, and we do not share
              your data with advertisers or marketing companies.
            </p>
          </div>
          <p className='text-gray-600 mt-4'>
            Any communications you receive from us will be related to your account, service updates,
            or important platform information only.
          </p>
        </section>

        {/* Policy Updates */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Calendar className='h-6 w-6 text-blue-600 mr-3' />
            Changes to This Policy
          </h2>
          <p className='text-gray-600'>
            We may update this Privacy Policy from time to time to reflect changes in our practices
            or for other operational, legal, or regulatory reasons. We will notify you of any
            material changes by posting the new Privacy Policy on this page and updating the
            &ldquo;Last updated&rdquo; date. Your continued use of the platform after such changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Contact Information */}
        <section className='mb-8'>
          <h2 className='text-2xl font-bold text-gray-900 mb-6 flex items-center'>
            <Mail className='h-6 w-6 text-blue-600 mr-3' />
            Contact Us
          </h2>
          <div className='bg-gray-50 p-4 rounded'>
            <p className='text-gray-700 mb-2'>
              If you have any questions about this Privacy Policy or our data practices, please
              contact us:
            </p>
            <div className='space-y-1 text-gray-600'>
              <p>Email: privacy@divemap.gr</p>
              <p>Subject: Divemap.gr Privacy Policy Inquiry</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className='text-center text-sm text-gray-500 border-t pt-6'>
          <p>
            This Privacy Policy is effective as of {new Date().toLocaleDateString()} and applies to
            all users of the Divemap platform.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
