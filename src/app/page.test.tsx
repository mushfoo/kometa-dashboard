import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Page />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Welcome to Kometa Dashboard');
  });

  it('renders the configuration section', () => {
    render(<Page />);
    const configLink = screen.getByRole('link', { name: /Configuration/ });
    expect(configLink).toBeInTheDocument();
    expect(configLink).toHaveAttribute('href', '/config');

    const configText = screen.getByText(/Manage your Kometa configuration/i);
    expect(configText).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    render(<Page />);

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');

    const collectionsLink = screen.getByRole('link', { name: /Collections/ });
    expect(collectionsLink).toHaveAttribute('href', '/collections');

    const logsLink = screen.getByRole('link', { name: /Logs/ });
    expect(logsLink).toHaveAttribute('href', '/logs');
  });

  it('renders the get started button', () => {
    render(<Page />);
    const getStartedButton = screen.getByRole('link', { name: /Get Started/i });
    expect(getStartedButton).toBeInTheDocument();
    expect(getStartedButton).toHaveAttribute('href', '/dashboard');
  });

  it('renders with correct styles', () => {
    render(<Page />);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex', 'min-h-screen', 'flex-col');
  });
});
