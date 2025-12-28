import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
  overlayClassName = '',
  trigger,
  showCloseButton = true,
  preventOutsideClick = false,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${overlayClassName}`}
        />
        <Dialog.Content
          className={`fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-white shadow-xl duration-200 p-6 sm:rounded-lg ${className}`}
          onPointerDownOutside={e => {
            if (preventOutsideClick) {
              e.preventDefault();
            }
          }}
        >
          <div className='flex items-center justify-between mb-0'>
            {title && (
              <Dialog.Title className='text-lg font-semibold text-gray-900'>{title}</Dialog.Title>
            )}
            {showCloseButton && (
              <Dialog.Close asChild>
                <button
                  className='absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground'
                  aria-label='Close'
                >
                  <X className='h-5 w-5 text-gray-500 hover:text-gray-700' />
                </button>
              </Dialog.Close>
            )}
          </div>
          {description && (
            <Dialog.Description className='text-sm text-gray-500 mb-4'>
              {description}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  description: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  overlayClassName: PropTypes.string,
  trigger: PropTypes.node,
  showCloseButton: PropTypes.bool,
  preventOutsideClick: PropTypes.bool,
};

export default Modal;
