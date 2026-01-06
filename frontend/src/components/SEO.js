import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SEO = ({
  title,
  description,
  type = 'website',
  image,
  imageWidth,
  imageHeight,
  imageAlt,
  article,
  publishedTime,
  modifiedTime,
  author,
  siteName = 'Divemap',
  locale = 'en_US',
  schema,
  location: geo, // { lat: number, lon: number }
}) => {
  const location = useLocation();
  const canonicalUrl = `${window.location.origin}${location.pathname}`;
  const fullTitle = title.includes('Divemap') ? title : `${title} - Divemap`;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{fullTitle}</title>
      <meta name='description' content={description} />
      <link rel='canonical' href={canonicalUrl} />
      <meta name='robots' content='index, follow, max-image-preview:large' />

      {/* Open Graph / Facebook */}
      <meta property='og:locale' content={locale} />
      <meta property='og:site_name' content={siteName} />
      <meta property='og:type' content={type} />
      <meta property='og:title' content={fullTitle} />
      <meta property='og:description' content={description} />
      <meta property='og:url' content={canonicalUrl} />
      {image && <meta property='og:image' content={image} />}
      {image && <meta property='og:image:secure_url' content={image} />}
      {image && imageWidth && <meta property='og:image:width' content={imageWidth} />}
      {image && imageHeight && <meta property='og:image:height' content={imageHeight} />}
      {image && imageAlt && <meta property='og:image:alt' content={imageAlt} />}

      {/* Place / Location Data */}
      {type === 'place' && geo && (
        <>
          <meta property='place:location:latitude' content={geo.lat} />
          <meta property='place:location:longitude' content={geo.lon} />
        </>
      )}

      {/* Article Specific Tags */}
      {type === 'article' && publishedTime && (
        <meta property='article:published_time' content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property='article:modified_time' content={modifiedTime} />
      )}
      {type === 'article' && author && <meta property='article:author' content={author} />}

      {/* Twitter */}
      <meta name='twitter:card' content={image ? 'summary_large_image' : 'summary'} />
      <meta name='twitter:title' content={fullTitle} />
      <meta name='twitter:description' content={description} />
      {image && <meta name='twitter:image' content={image} />}

      {/* Structured Data (JSON-LD) */}
      {schema && <script type='application/ld+json'>{JSON.stringify(schema)}</script>}
    </Helmet>
  );
};

SEO.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  type: PropTypes.string,
  image: PropTypes.string,
  article: PropTypes.bool,
  publishedTime: PropTypes.string,
  modifiedTime: PropTypes.string,
  author: PropTypes.string,
  siteName: PropTypes.string,
  locale: PropTypes.string,
  schema: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  imageWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  imageHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  imageAlt: PropTypes.string,
  location: PropTypes.shape({
    lat: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    lon: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

export default SEO;
