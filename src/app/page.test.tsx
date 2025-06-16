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
    const configText = screen.getByText(
      /Manage your Kometa configuration with visual tools/i
    );
    expect(configText).toBeInTheDocument();
  });

  it('renders with correct styles', () => {
    render(<Page />);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('flex', 'min-h-screen', 'flex-col');
  });
});
