import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
      description: 'The visual style of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: 'HTML button type',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Primary button story
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

// Secondary button story
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

// Danger button story
export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    variant: 'primary',
    children: 'Disabled Button',
    disabled: true,
  },
};

// Button sizes (with custom className)
export const Small: Story = {
  args: {
    variant: 'primary',
    children: 'Small Button',
    className: 'text-sm py-1 px-2',
  },
};

export const Large: Story = {
  args: {
    variant: 'primary',
    children: 'Large Button',
    className: 'text-lg py-3 px-6',
  },
};

// Different content types
export const WithEmoji: Story = {
  args: {
    variant: 'primary',
    children: '🚀 Launch',
  },
};

export const LongText: Story = {
  args: {
    variant: 'primary',
    children: 'This is a button with much longer text content',
  },
};

// Interactive example
export const ClickCounter: Story = {
  args: {
    children: 'Click me!',
  },
  render: (args) => {
    const [count, setCount] = React.useState(0);

    return (
      <div className="space-y-4 text-center">
        <p className="text-lg">Clicked {count} times</p>
        <div className="space-x-2">
          <Button onClick={() => setCount(count + 1)}>{args.children}</Button>
          <Button variant="secondary" onClick={() => setCount(0)}>
            Reset
          </Button>
        </div>
      </div>
    );
  },
};

// Import React for the interactive story
import React from 'react';
