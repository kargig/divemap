import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Image as AntImage, Collapse, Card, Tooltip } from 'antd';
import { InboxOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import PropTypes from 'prop-types';

import { uploadPhotoToR2Only, deletePhotoFromR2, deleteDiveMedia } from '../api';

const { Dragger } = Upload;

/**
 * Reusable photo upload component with Collapse, drag-and-drop, and per-photo controls
 * 
 * @param {string} id - The dive/resource ID for API calls
 * @param {Array} mediaUrls - Array of media items (photos) to display
 * @param {Function} setMediaUrls - Function to update mediaUrls
 * @param {Function} onUnsavedPhotosChange - Callback that receives unsavedR2Photos array when it changes
 * @param {Function} onMediaRemove - Optional callback for handling media removal (for saved media)
 * @param {Array} savedPhotoUids - Array of UIDs for photos that have been saved to DB (to clear from unsaved list)
 */
const UploadCustomComponent = ({ id, mediaUrls, setMediaUrls, onUnsavedPhotosChange, onMediaRemove, savedPhotoUids = [] }) => {
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

  // Cleanup: Only delete unsaved photos on component unmount, not on state changes
  useEffect(() => {
    return () => {
      // Delete any photos that were uploaded to R2 but not saved to database
      // Use ref to get the latest value without triggering cleanup on every change
      if (unsavedR2PhotosRef.current.length > 0) {
        unsavedR2PhotosRef.current.forEach(photo => {
          deletePhotoFromR2(id, photo.r2_path).catch(error => {
            console.error(`Failed to cleanup unsaved R2 photo ${photo.r2_path}:`, error);
          });
        });
      }
    };
  }, [id]);

  // Helper function to get base64 for preview
  const getBase64 = (file) =>
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
  const handlePreview = async (file) => {
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
          (f.uid === fileUid || f.originFileObj === file) ? { ...f, percent: 0, status: 'uploading' } : f
        )
      );
      
      // Upload to R2 only (no database record created yet)
      const r2UploadResult = await uploadPhotoToR2Only(id, file);

      onProgress({ percent: 100 });

      // Store photo info for later DB creation when Update Dive is pressed
      // Default to true for is_public, can be changed per photo
      const unsavedPhoto = {
        uid: fileUid,
        r2_path: r2UploadResult.r2_path,
        url: r2UploadResult.url,
        file_name: file.name,
        description: '',
        is_public: true, // Default to public, can be changed per photo
      };
      setUnsavedR2Photos(prev => [...prev, unsavedPhoto]);

      // Create temporary media item for display (no DB ID yet)
      const mediaItem = {
        id: null, // No DB ID yet
        type: 'photo',
        url: r2UploadResult.url,
        description: '',
        title: '',
        is_public: true, // Default to public, can be changed per photo
        uploaded: false, // Not saved to DB yet
        original_filename: file.name,
        temp_uid: fileUid, // Track this for later DB creation
      };

      // Remove from uploadFileList (match by both UID and originFileObj to catch all cases)
      setUploadFileList(prev => prev.filter(f => f.uid !== fileUid && f.originFileObj !== file));
      setMediaUrls(prev => [...prev, mediaItem]);
      toast.success(`Successfully uploaded ${file.name} It will show on Dive when you finish editing`);
      
      // Call onSuccess with the file to mark it as done in Ant Design's internal state
      // Use fileUid to ensure it matches the temp_uid in mediaUrls, preventing duplicates
      onSuccess({ ...file, uid: fileUid, url: r2UploadResult.url, status: 'done' }, file);
      setUploadingPhotos(false);
    } catch (error) {
      // Update file status to error
      setUploadFileList(prev =>
        prev.map(f =>
          (f.uid === fileUid || f.originFileObj === file) ? { ...f, status: 'error' } : f
        )
      );
      onError(error);
      setUploadingPhotos(false);
      toast.error(`Failed to upload ${file.name}: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Handle file removal (called directly when remove button is clicked)
  const handleRemove = async (file) => {
    // Check if it's an unsaved R2 photo (has temp_uid)
    const unsavedPhoto = unsavedR2Photos.find(p => p.uid === file.uid);
    if (unsavedPhoto) {
      // Delete from R2 and remove from state
      try {
        await deletePhotoFromR2(id, unsavedPhoto.r2_path);
        setUnsavedR2Photos(prev => prev.filter(p => p.uid !== file.uid));
        setMediaUrls(prev => prev.filter(m => m.temp_uid !== file.uid));
        setUploadFileList(prev => prev.filter(f => f.uid !== file.uid));
        toast.success('Photo removed');
        return true; // Allow Ant Design to remove it immediately
      } catch (error) {
        toast.error(`Failed to delete photo: ${error.response?.data?.detail || error.message}`);
        return false;
      }
    }

    // Find the mediaItem by UID (which should match the media ID)
    const mediaItem = mediaUrls.find(m => m.type === 'photo' && (m.id?.toString() === file.uid || m.temp_uid === file.uid));
    
    if (mediaItem) {
      // If onMediaRemove is provided, use it; otherwise handle deletion here
      if (onMediaRemove) {
        onMediaRemove(mediaItem);
      } else {
        // Default behavior: delete from backend if it has an ID
        if (mediaItem.id) {
          try {
            const mediaId = typeof mediaItem.id === 'number' ? mediaItem.id : parseInt(mediaItem.id);
            if (!isNaN(mediaId)) {
              await deleteDiveMedia(id, mediaId);
              toast.success('Photo deleted successfully');
              setMediaUrls(prev => prev.filter(item => item.id !== mediaItem.id));
            }
          } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete photo');
          }
        } else {
          // Just remove from local state if no ID
          setMediaUrls(prev => prev.filter(item => item.temp_uid !== file.uid));
        }
      }
      return false; // Prevent Ant Design from removing it immediately
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

  // Handle toggling is_public for a specific photo
  const handlePhotoPublicToggle = (fileUid, isPublic) => {
    // Update in mediaUrls
    setMediaUrls(prev =>
      prev.map(item =>
        (item.id?.toString() === fileUid || item.temp_uid === fileUid)
          ? { ...item, is_public: isPublic }
          : item
      )
    );

    // Update in unsavedR2Photos if it exists
    setUnsavedR2Photos(prev =>
      prev.map(photo => (photo.uid === fileUid ? { ...photo, is_public: isPublic } : photo))
    );
  };

  // Handle description change for a specific photo
  const handlePhotoDescriptionChange = (fileUid, description) => {
    // Update in mediaUrls
    setMediaUrls(prev =>
      prev.map(item =>
        (item.id?.toString() === fileUid || item.temp_uid === fileUid)
          ? { ...item, description }
          : item
      )
    );

    // Update in unsavedR2Photos if it exists
    setUnsavedR2Photos(prev =>
      prev.map(photo => (photo.uid === fileUid ? { ...photo, description } : photo))
    );
  };

  // Custom item render to add "Make public" checkbox and description field underneath each list item
  const itemRender = (originNode, file, fileList, actions) => {
    // Find the media item to get is_public status and description
    const mediaItem = mediaUrls.find(
      m =>
        m.type === 'photo' &&
        (m.id?.toString() === file.uid || m.temp_uid === file.uid)
    );
    const isPublic = mediaItem?.is_public ?? true;
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
          <div className='flex flex-col gap-2'>
            {/* Public checkbox */}
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={isPublic}
                onChange={e => {
                  e.stopPropagation();
                  handlePhotoPublicToggle(file.uid, e.target.checked);
                }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer'
              />
              <span className='text-sm text-gray-700 font-medium select-none'>Make public</span>
              <Tooltip title='Visible on dive site and the dive if dive is public'>
                <InfoCircleOutlined className='text-gray-400 hover:text-gray-600 cursor-help' />
              </Tooltip>
            </label>
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
                  Support for JPEG, JPG, PNG, GIF, and WebP formats. Multiple files can be uploaded at once.
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

UploadCustomComponent.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  mediaUrls: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      type: PropTypes.string,
      url: PropTypes.string,
      description: PropTypes.string,
      is_public: PropTypes.bool,
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

export default UploadCustomComponent;

