import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from '../Layout';

// Mock the child components
jest.mock('../Sidebar', () => ({
  Sidebar: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="sidebar" data-open={isOpen}>
      <button onClick={onClose}>Close Sidebar</button>
    </div>
  ),
}));

jest.mock('../Header', () => ({
  Header: ({ onMenuClick }: { onMenuClick: () => void }) => (
    <div data-testid="header">
      <button onClick={onMenuClick}>Open Menu</button>
    </div>
  ),
}));

describe('Layout', () => {
  it('renders children correctly', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders header and sidebar', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('toggles sidebar state when menu button is clicked', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    const sidebar = screen.getByTestId('sidebar');
    const menuButton = screen.getByText('Open Menu');

    // Initially closed
    expect(sidebar).toHaveAttribute('data-open', 'false');

    // Click to open
    fireEvent.click(menuButton);
    expect(sidebar).toHaveAttribute('data-open', 'true');

    // Click to close
    fireEvent.click(menuButton);
    expect(sidebar).toHaveAttribute('data-open', 'false');
  });

  it('closes sidebar when close button is clicked', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    const sidebar = screen.getByTestId('sidebar');
    const menuButton = screen.getByText('Open Menu');
    const closeButton = screen.getByText('Close Sidebar');

    // Open sidebar first
    fireEvent.click(menuButton);
    expect(sidebar).toHaveAttribute('data-open', 'true');

    // Close sidebar
    fireEvent.click(closeButton);
    expect(sidebar).toHaveAttribute('data-open', 'false');
  });

  it('has correct layout structure', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    const layout = screen.getByText('Test Content').closest('.min-h-screen');
    expect(layout).toHaveClass(
      'min-h-screen',
      'bg-gray-50',
      'dark:bg-gray-900'
    );
  });
});
