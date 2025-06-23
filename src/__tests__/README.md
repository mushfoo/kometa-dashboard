# Test Documentation

## Filter Mapping Tests

### Overview

The filter mapping tests validate that UI field names are correctly mapped to Kometa's expected YAML format.

### Key Mappings

| UI Field        | Kometa Field  | Example                     |
| --------------- | ------------- | --------------------------- |
| `rating`        | `user_rating` | `user_rating.gte: 7.0`      |
| `date_added`    | `added`       | `added.gte: "2024-01-01"`   |
| `date_released` | `release`     | `release.lte: "2023-12-31"` |
| `availability`  | `streaming`   | `streaming: "Netflix"`      |
| `content_type`  | `type`        | `type: "movie"`             |

### Test Files

- **`src/__tests__/types/filters.test.ts`**: Unit tests for filter serialization logic
- **`src/__tests__/api/collections-filter.test.ts`**: Integration tests for collections API with YAML generation

### Expected Kometa Structure

Smart collections must include the `plex_all: true` builder and use direct properties for filters:

```yaml
collections:
  Action Movies:
    plex_all: true
    genre: Action
    user_rating.gte: 7.0
    year.gte: 2000
```

### Test Coverage

- ✅ Field name mappings (rating → user_rating, etc.)
- ✅ Dot notation operators (.gte, .lte, .not)
- ✅ Filter exclusions (genre.not, year.not)
- ✅ Complex filter combinations
- ✅ YAML structure validation
- ✅ API integration with plex_all builder
- ✅ Error handling and edge cases

### Running Tests

```bash
# Run filter unit tests
npm run test src/__tests__/types/filters.test.ts

# Run API integration tests
npm run test src/__tests__/api/collections-filter.test.ts

# Run all tests
npm run test
```
