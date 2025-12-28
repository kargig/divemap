import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const DropdownMenu = ({ trigger, items = [], className = '' }) => {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          className={`z-[100] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className}`}
          sideOffset={5}
        >
          {items.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <DropdownMenuPrimitive.Separator
                  key={`sep-${index}`}
                  className='-mx-1 my-1 h-px bg-gray-100'
                />
              );
            }

            if (item.type === 'label') {
              return (
                <DropdownMenuPrimitive.Label
                  key={`label-${index}`}
                  className='px-2 py-1.5 text-sm font-semibold'
                >
                  {item.label}
                </DropdownMenuPrimitive.Label>
              );
            }

            if (item.type === 'item') {
              return (
                <DropdownMenuPrimitive.Item
                  key={`item-${index}`}
                  className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer ${item.className || ''}`}
                  onClick={item.onClick}
                  disabled={item.disabled}
                >
                  {item.icon && <span className='mr-2 h-4 w-4'>{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className='ml-auto text-xs tracking-widest opacity-60'>
                      {item.shortcut}
                    </span>
                  )}
                </DropdownMenuPrimitive.Item>
              );
            }

            if (item.type === 'sub') {
              return (
                <DropdownMenuPrimitive.Sub key={`sub-${index}`}>
                  <DropdownMenuPrimitive.SubTrigger className='flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-gray-100 data-[state=open]:bg-gray-100'>
                    {item.icon && <span className='mr-2 h-4 w-4'>{item.icon}</span>}
                    <span>{item.label}</span>
                    <ChevronRight className='ml-auto h-4 w-4' />
                  </DropdownMenuPrimitive.SubTrigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.SubContent className='z-[110] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'>
                      {item.children.map((subItem, subIndex) => (
                        <DropdownMenuPrimitive.Item
                          key={`sub-item-${subIndex}`}
                          className='relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer'
                          onClick={subItem.onClick}
                        >
                          {subItem.label}
                        </DropdownMenuPrimitive.Item>
                      ))}
                    </DropdownMenuPrimitive.SubContent>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Sub>
              );
            }

            return null;
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
};

DropdownMenu.propTypes = {
  trigger: PropTypes.node.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.oneOf(['item', 'label', 'separator', 'sub']).isRequired,
      label: PropTypes.string,
      onClick: PropTypes.func,
      icon: PropTypes.node,
      shortcut: PropTypes.string,
      disabled: PropTypes.bool,
      className: PropTypes.string,
      children: PropTypes.array, // For submenus
    })
  ).isRequired,
  className: PropTypes.string,
};

export default DropdownMenu;
