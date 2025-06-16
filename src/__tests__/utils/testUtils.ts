import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Custom test utilities and helper functions
 */

// Wait for loading states to resolve
export async function waitForLoadingToFinish() {
  await waitFor(
    () => {
      const loaders = [
        ...screen.queryAllByTestId(/loading/i),
        ...screen.queryAllByText(/loading/i),
        ...screen.queryAllByRole('progressbar'),
      ];
      expect(loaders).toHaveLength(0);
    },
    { timeout: 3000 }
  );
}

// Assert element is visible and enabled
export function assertElementVisible(element: HTMLElement) {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
  expect(element).not.toBeDisabled();
}

// Common form testing helpers
export const formHelpers = {
  async fillInput(label: string, value: string) {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    await userEvent.type(input, value);
    return input;
  },

  async selectOption(label: string, optionText: string) {
    const select = screen.getByLabelText(label);
    await userEvent.selectOptions(select, optionText);
    return select;
  },

  async checkCheckbox(label: string) {
    const checkbox = screen.getByLabelText(label) as HTMLInputElement;
    if (!checkbox.checked) {
      await userEvent.click(checkbox);
    }
    return checkbox;
  },

  async submitForm(buttonText = 'Submit') {
    const submitButton = screen.getByRole('button', { name: buttonText });
    await userEvent.click(submitButton);
    return submitButton;
  },
};

// API testing helpers
export const apiHelpers = {
  expectApiCall(url: string, method = 'GET') {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    const calls = mockFetch.mock.calls.filter(
      ([callUrl, options]) =>
        callUrl === url && (!options?.method || options.method === method)
    );
    expect(calls.length).toBeGreaterThan(0);
    return calls;
  },

  mockApiResponse(data: any, status = 200) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  },
};

// Accessibility testing helpers
export const a11yHelpers = {
  assertNoA11yViolations(container: HTMLElement) {
    // Check for basic accessibility attributes
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button).toHaveAccessibleName();
    });

    const inputs = container.querySelectorAll('input');
    inputs.forEach((input) => {
      const label = container.querySelector(`label[for="${input.id}"]`);
      expect(label || input.getAttribute('aria-label')).toBeTruthy();
    });
  },
};

// Mock data generators
export const generateMockData = {
  collection(overrides = {}) {
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Test Collection',
      type: 'smart',
      itemCount: Math.floor(Math.random() * 100),
      lastUpdated: new Date().toISOString(),
      ...overrides,
    };
  },

  operation(overrides = {}) {
    return {
      id: `op_${Date.now()}`,
      type: 'scan',
      status: 'running',
      startTime: new Date().toISOString(),
      progress: {
        current: 50,
        total: 100,
      },
      ...overrides,
    };
  },

  log(overrides = {}) {
    return {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Test log message',
      ...overrides,
    };
  },
};

// Custom matchers
export const customMatchers = {
  toHaveErrorMessage(element: HTMLElement, message: string) {
    const errorElement = element.querySelector('[role="alert"]');
    return {
      pass: errorElement?.textContent?.includes(message) ?? false,
      message: () =>
        `Expected element to have error message "${message}", but found "${errorElement?.textContent}"`,
    };
  },
};
