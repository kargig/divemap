import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Image as AntImage, Collapse, Card } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import PropTypes from 'prop-types';

// Note: uploadPhotoToR2Only and deletePhotoFromR2 are not needed here
// Photos are only uploaded to R2 when form is submitted (handled in parent components)
// deleteDiveMedia is handled via onMediaRemove callback for saved photos

const { Dragger } = Upload;

/**
 * Reusable photo upload component with Collapse, drag-and-drop, and per-photo controls
 *
 * @param {string|number|null} id - The dive/resource ID for API calls (null/undefined for create flows)
 * @param {Array} mediaUrls - Array of media items (photos) to display
 * @param {Function} setMediaUrls - Function to update mediaUrls
 * @param {Function} onUnsavedPhotosChange - Callback that receives unsavedR2Photos array when it changes
 * @param {Function} onMediaRemove - Optional callback for handling media removal (for saved media)
 * @param {Array} savedPhotoUids - Array of UIDs for photos that have been saved to DB (to clear from unsaved list)
 */
const UploadPhotosComponent = ({
  id,
  mediaUrls,
  setMediaUrls,
  onUnsavedPhotosChange,
  onMediaRemove,
  savedPhotoUids = [],
}) => {
  // State for upload management
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [unsavedR2Photos, setUnsavedR2Photos] = useState([]);
  const [uploadFileList, setUploadFileList] = useState([]);

  // Use ref to track unsaved photos for cleanup (only on unmount, not on state changes)
  const unsavedR2PhotosRef = useRef([]);

  // Update ref whenever unsavedR2Photos changes
  useEffect(() => {
    unsavedR2PhotosRef.current = unsavedR2Photos;
    // Notify parent of changes
    if (onUnsavedPhotosChange) {
      onUnsavedPhotosChange(unsavedR2Photos);
    }
  }, [unsavedR2Photos, onUnsavedPhotosChange]);

  // Clear unsaved photos that have been saved to DB (when parent signals they're saved)
  useEffect(() => {
    if (savedPhotoUids.length > 0) {
      setUnsavedR2Photos(prev => prev.filter(photo => !savedPhotoUids.includes(photo.uid)));
    }
  }, [savedPhotoUids]);

  // Cleanup: No R2 cleanup needed since photos are only uploaded on form submission
  // Photos stored locally (base64 previews) are automatically cleaned up when component unmounts

  // Helper function to get base64 for preview
  const getBase64 = file =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

  // Convert mediaUrls photos to Upload fileList format and merge with uploadFileList
  const photoFileList = useMemo(() => {
    const uploadedFiles = mediaUrls
      .filter(media => media.type === 'photo')
      .map((media, index) => {
        // Use original filename if available, otherwise extract from URL
        const displayName = media.original_filename || 'photo.jpg';

        // Use temp_uid for newly uploaded files (not yet saved to DB), otherwise use id
        const uid = media.id?.toString() || media.temp_uid || `uploaded-${index}`;

        return {
          uid,
          name: displayName,
          status: 'done',
          url: media.url,
          thumbUrl: media.url,
          mediaItem: media, // Store reference to original media item
        };
      });

    // Merge uploaded files with files currently in upload process
    // uploadFileList contains files that are selected/uploading but not yet in mediaUrls
    const uploadedFileUids = new Set(uploadedFiles.map(f => f.uid));
    const uploadingFiles = uploadFileList.filter(f => !uploadedFileUids.has(f.uid));

    return [...uploadedFiles, ...uploadingFiles];
  }, [mediaUrls, uploadFileList]);

  // Handle file preview
  const handlePreview = async file => {
    if (!file.url && !file.preview) {
      if (file.originFileObj) {
        file.preview = await getBase64(file.originFileObj);
      }
    }
    setPreviewImage(file.url || file.preview);
    setPreviewOpen(true);
  };

  // Custom upload handler
  const customRequest = async ({ file, onSuccess, onError, onProgress }) => {
    const fileUid = file.uid || `upload-${Date.now()}-${Math.random()}`;

    // Add file to uploadFileList with uploading status, storing original file reference
    setUploadFileList(prev => [
      ...prev.filter(f => f.uid !== fileUid && f.originFileObj !== file),
      {
        uid: fileUid,
        name: file.name,
        status: 'uploading',
        percent: 0,
        originFileObj: file, // Store reference to original file object
      },
    ]);

    try {
      setUploadingPhotos(true);
      onProgress({ percent: 0 });

      // Update progress
      setUploadFileList(prev =>
        prev.map(f =>
          f.uid === fileUid || f.originFileObj === file
            ? { ...f, percent: 0, status: 'uploading' }
            : f
        )
      );

      let r2UploadResult = null;
      let previewUrl = null;

      // If id is provided (edit flow), upload to R2 immediately
      // If id is null/undefined (create flow), store file locally and upload later
      if (id) {
        // Upload to R2 only (no database record created yet)
        r2UploadResult = await uploadPhotoToR2Only(id, file);
        previewUrl = r2UploadResult.url;
      } else {
        // For create flow, create a local preview URL from the file
        previewUrl = await getBase64(file);
      }

      onProgress({ percent: 100 });

      // Store photo info for later DB creation
      // For create flow, we'll upload to R2 after dive is created
      const unsavedPhoto = {
        uid: fileUid,
        r2_path: r2UploadResult?.r2_path || null, // null for create flow, will be set after upload
        url: previewUrl,
        file_name: file.name,
        description: '',
        originFileObj: id ? null : file, // Store file object for create flow to upload later
      };
      setUnsavedR2Photos(prev => [...prev, unsavedPhoto]);

      // Create temporary media item for display (no DB ID yet)
      const mediaItem = {
        id: null, // No DB ID yet
        type: 'photo',
        url: previewUrl,
        description: '',
        title: '',
        uploaded: false, // Not saved to DB yet
        original_filename: file.name,
        temp_uid: fileUid, // Track this for later DB creation
      };

      // Remove from uploadFileList (match by both UID and originFileObj to catch all cases)
      setUploadFileList(prev => prev.filter(f => f.uid !== fileUid && f.originFileObj !== file));
      setMediaUrls(prev => [...prev, mediaItem]);
      toast.success(
        `Successfully ${id ? 'uploaded' : 'added'} ${file.name}${id ? ' It will show on Dive when you finish editing' : ''}`
      );

      // Call onSuccess with the file to mark it as done in Ant Design's internal state
      // Use fileUid to ensure it matches the temp_uid in mediaUrls, preventing duplicates
      onSuccess({ ...file, uid: fileUid, url: previewUrl, status: 'done' }, file);
      setUploadingPhotos(false);
    } catch (error) {
      // Update file status to error
      setUploadFileList(prev =>
        prev.map(f =>
          f.uid === fileUid || f.originFileObj === file ? { ...f, status: 'error' } : f
        )
      );
      onError(error);
      setUploadingPhotos(false);
      toast.error(
        `Failed to ${id ? 'upload' : 'add'} ${file.name}: ${error.response?.data?.detail || error.message}`
      );
    }
  };

  // Handle file removal (called directly when remove button is clicked)
  const handleRemove = async file => {
    // Check if it's an unsaved photo (local preview, not yet uploaded to R2)
    const unsavedPhoto = unsavedR2Photos.find(p => p.uid === file.uid);
    if (unsavedPhoto) {
      // Just remove from local state - no API calls needed since photo wasn't uploaded to R2 yet
      setUnsavedR2Photos(prev => prev.filter(p => p.uid !== file.uid));
      setMediaUrls(prev => prev.filter(m => m.temp_uid !== file.uid));
      setUploadFileList(prev => prev.filter(f => f.uid !== file.uid));
      toast.success('Photo removed');
      return true; // Allow Ant Design to remove it immediately
    }

    // Find the mediaItem by UID (which should match the media ID)
    const mediaItem = mediaUrls.find(
      m => m.type === 'photo' && (m.id?.toString() === file.uid || m.temp_uid === file.uid)
    );

    if (mediaItem) {
      // If photo has a DB ID, it's been saved - use onMediaRemove callback to delete from backend
      // If onMediaRemove is provided, use it; otherwise just remove from local state
      if (onMediaRemove) {
        onMediaRemove(mediaItem);
      } else {
        // No callback provided - just remove from local state
        // (This shouldn't happen in normal usage, but handle gracefully)
        setMediaUrls(prev =>
          prev.filter(item => item.id !== mediaItem.id && item.temp_uid !== file.uid)
        );
      }
      return false; // Prevent Ant Design from removing it immediately (let parent handle it)
    } else {
      // For files that are not yet uploaded (just selected), remove from uploadFileList
      setUploadFileList(prev => prev.filter(f => f.uid !== file.uid));
      return true; // Allow Ant Design to remove it immediately
    }
  };

  // Handle file list change (for adding files)
  const handleFileListChange = ({ fileList: newFileList }) => {
    // Build set of all uploaded file UIDs (both from DB and temp uploads)
    const uploadedFileUids = new Set(
      mediaUrls
        .filter(m => m.type === 'photo')
        .map(m => m.id?.toString() || m.temp_uid)
        .filter(Boolean) // Remove null/undefined values
    );

    // Filter out files that are already uploaded (from mediaUrls) - these are managed separately
    // Also filter out files with status 'done' that don't match uploaded UIDs (these are duplicates from Ant Design)
    const filesNotYetUploaded = newFileList.filter(f => {
      // Exclude files that are already uploaded (in mediaUrls) - match by UID
      if (uploadedFileUids.has(f.uid) && f.status === 'done') {
        return false;
      }

      // Exclude files with status 'done' that don't have a URL (these are duplicates)
      // Uploaded files should have a URL from mediaUrls, so files with status 'done' but no URL
      // are likely duplicates from Ant Design that should be removed
      if (f.status === 'done' && !f.url) {
        return false;
      }

      // Include all other files (uploading, error, newly selected with any status, etc.)
      return true;
    });

    // Update uploadFileList with files that are not yet uploaded
    setUploadFileList(filesNotYetUploaded);
  };

  // Handle description change for a specific photo
  const handlePhotoDescriptionChange = (fileUid, description) => {
    // Update in mediaUrls
    setMediaUrls(prev =>
      prev.map(item =>
        item.id?.toString() === fileUid || item.temp_uid === fileUid
          ? { ...item, description }
          : item
      )
    );

    // Update in unsavedR2Photos if it exists
    setUnsavedR2Photos(prev =>
      prev.map(photo => (photo.uid === fileUid ? { ...photo, description } : photo))
    );
  };

  // Custom item render to add description field underneath each list item
  const itemRender = (originNode, file, fileList, actions) => {
    // Find the media item to get description
    const mediaItem = mediaUrls.find(
      m => m.type === 'photo' && (m.id?.toString() === file.uid || m.temp_uid === file.uid)
    );
    const description = mediaItem?.description || '';

    // Wrap originNode and controls in a Card
    return (
      <Card
        style={{
          borderColor: '#2d6b8a',
          borderWidth: '2px',
          marginTop: '6px',
          marginBottom: '6px',
        }}
      >
        {/* Original upload list item */}
        {originNode}
        {/* Controls underneath the item */}
        <div
          className='mt-2 p-2 bg-gray-50 rounded border border-gray-200'
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          {/* Description input field */}
          <input
            type='text'
            value={description}
            onChange={e => {
              e.stopPropagation();
              handlePhotoDescriptionChange(file.uid, e.target.value);
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            placeholder='Add description...'
            className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
          />
        </div>
      </Card>
    );
  };

  /** @type {import('antd').UploadProps} */
  const uploadProps = {
    customRequest,
    listType: 'picture',
    fileList: photoFileList,
    onPreview: handlePreview,
    onRemove: handleRemove,
    onChange: handleFileListChange,
    accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
    multiple: true,
    disabled: uploadingPhotos,
    itemRender,
  };

  return (
    <Collapse
      items={[
        {
          key: '1',
          label: 'Upload Photos',
          children: (
            <div className='space-y-3'>
              {/* Ant Design Upload with Drag and Drop */}
              <Dragger {...uploadProps}>
                <p className='ant-upload-drag-icon'>
                  <InboxOutlined />
                </p>
                <p className='ant-upload-text'>Click or drag photos to this area to upload</p>
                <p className='ant-upload-hint'>
                  Support for JPEG, JPG, PNG, GIF, and WebP formats. Multiple files can be uploaded
                  at once.
                </p>
              </Dragger>

              {/* Preview Modal */}
              {previewImage && (
                <AntImage
                  style={{ display: 'none' }}
                  preview={{
                    open: previewOpen,
                    onOpenChange: visible => {
                      setPreviewOpen(visible);
                      if (!visible) {
                        setPreviewImage('');
                      }
                    },
                    afterOpenChange: visible => !visible && setPreviewImage(''),
                  }}
                  src={previewImage}
                />
              )}
            </div>
          ),
        },
      ]}
    />
  );
};

UploadPhotosComponent.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  mediaUrls: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      type: PropTypes.string,
      url: PropTypes.string,
      description: PropTypes.string,
      original_filename: PropTypes.string,
      temp_uid: PropTypes.string,
      uploaded: PropTypes.bool,
    })
  ).isRequired,
  setMediaUrls: PropTypes.func.isRequired,
  onUnsavedPhotosChange: PropTypes.func,
  onMediaRemove: PropTypes.func,
  savedPhotoUids: PropTypes.arrayOf(PropTypes.string),
};

export default UploadPhotosComponent;
