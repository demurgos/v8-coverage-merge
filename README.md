# v8-coverage-merge

[![Build Status](https://travis-ci.org/bcoe/v8-coverage-merge.svg?branch=master)](https://travis-ci.org/bcoe/v8-coverage-merge)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Coverage Status](https://coveralls.io/repos/github/bcoe/v8-coverage-merge/badge.svg?branch=master)](https://coveralls.io/github/bcoe/v8-coverage-merge?branch=master)

Merges together the V8 inspector format JSON output for duplicate scripts:

```js
const merge = require('v8-coverage-merge')
const merged = merge(
  {
    scriptId: '70',
    url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
    functions: [
      {
        functionName: 'bar',
        isBlockCoverage: true,
        ranges: [
          {
            startOffset: 30,
            endOffset: 221,
            count: 1
          }
        ]
      }
    ]
  },
  {
    scriptId: '71',
    url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
    functions: [
      {
        functionName: 'foo',
        isBlockCoverage: true,
        ranges: [
          {
            startOffset: 70,
            endOffset: 400,
            count: 2
          }
        ]
      }
    ]
  }
)
```

Merging is necessary if coverage is output from multiple subprocesses.

# Merge Algorithm

The merge algorithm can be pretty tricky: the intent of this section is to explain the
main ideas of the algorithm.

## Terminology

First of all, let's clarify some terms that will be used in the rest of this section:

- `ProcessCoverage`: A list of script coverages obtained during the execution of the same Node process.
- `ScriptCoverage`: Represents the coverage for a given file (identified by its url). It countains
  a list of function coverages.
- `FunctionCoverage`: Represents the coverage for a given function, or block of code, or whole module.
  I believe this is related to V8's internals and how they store their logical blocks of code.
  It contains a list of coverage ranges.
- `CoverageRange`: The primary unit of coverage. Contains the number of times a span of
  code was executed.

The high level goal is to merge multiple process coverages.
