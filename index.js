module.exports = mergeScripts

function mergeScripts (...scripts) {
  if (scripts.length === 0) {
    return undefined
  }
  const first = scripts[0]
  const hashToFns = new Map()
  for (const script of scripts) {
    for (const fn of script.functions) {
      const hash = hashFunction(fn)
      let fns = hashToFns.get(hash)
      if (fns === undefined) {
        fns = []
        hashToFns.set(hash, fns)
      }
      fns.push(fn)
    }
  }
  const functions = []
  for (const fns of hashToFns.values()) {
    functions.push(mergeFunctions(fns))
  }
  return {
    scriptId: first.scriptId,
    url: first.url,
    functions
  }
}

function mergeFunctions (fns) {
  if (fns.length === 0) {
    return undefined
  }
  const first = fns[0]
  const trees = fns.map(fn => createRangeTree(fn.ranges))
  const mergedTree = mergeRangeTrees(trees)
  const normalizedTree = normalizeRangeTree(mergedTree)
  const ranges = flattenRangeTree(normalizedTree)
  return {
    functionName: first.functionName,
    ranges,
    isBlockCoverage: first.isBlockCoverage
  }
}

/**
 * @precodition `ranges` are well-formed and pre-order sorted
 */
function createRangeTree (ranges) {
  const first = ranges[0]
  const root = {start: first.startOffset, end: first.endOffset, count: first.count, children: []}
  const stack = [root]
  for (let i = 1; i < ranges.length; i++) {
    const range = ranges[i]
    const node = {start: range.startOffset, end: range.endOffset, count: range.count, children: []}
    let top
    // The loop condition is only there for safety, it should always be true.
    while (stack.length > 0) {
      top = stack[stack.length - 1]
      if (range.startOffset >= top.end) {
        stack.pop()
        top = stack[stack.length - 1]
      } else {
        break
      }
    }
    top.children.push(node)
    stack.push(node)
  }
  return root
}

function flattenRangeTree (tree) {
  const ranges = [{startOffset: tree.start, endOffset: tree.end, count: tree.count}]
  for (const child of tree.children) {
    for (const range of flattenRangeTree(child)) {
      ranges.push(range)
    }
  }
  return ranges
}

function normalizeRangeTree (tree) {
  const children = []
  let prevChild
  for (const child of tree.children) {
    if (prevChild === undefined) {
      prevChild = child
      continue
    }
    if (prevChild.count === child.count && prevChild.end === child.start) {
      prevChild = {
        start: prevChild.start,
        end: child.end,
        count: prevChild.count,
        children: [...prevChild.children, ...child.children],
      }
    } else {
      children.push(normalizeRangeTree(prevChild))
      prevChild = child
    }
  }
  if (prevChild !== undefined) {
    children.push(normalizeRangeTree(prevChild))
  }
  return {...tree, children}
}

/**
 * @precondition `tree.start < value && value < tree.end`
 */
function splitRangeTree (tree, value) {
  const leftChildren = []
  const rightChildren = []
  for (const child of tree.children) {
    if (child.end <= value) {
      leftChildren.push(child)
    } else if (child.start < value) {
      const [left, right] = splitRangeTree(child, value)
      leftChildren.push(left)
      rightChildren.push(right)
    } else {
      rightChildren.push(child)
    }
  }
  return [
    {start: tree.start, end: value, count: tree.count, children: leftChildren},
    {start: value, end: tree.end, count: tree.count, children: rightChildren},
  ]
}

/**
 * @precondition Same `start` and `end` for all the trees
 */
function mergeRangeTrees (trees) {
  if (trees.length === 0) {
    return undefined
  }
  const first = trees[0]
  return {
    start: first.start,
    end: first.end,
    count: trees.reduce((acc, tree) => acc + tree.count, 0),
    children: mergeRangeTreeLists(trees.map(tree => tree.children), trees.map(tree => tree.count)),
  }
}

function mergeRangeTreeLists (treeLists, parentCounts) {
  const eventSet = new Set()
  for (const treeList of treeLists) {
    for (const tree of treeList) {
      eventSet.add(tree.start)
      eventSet.add(tree.end)
    }
  }
  const events = [...eventSet]
  numSort(events)
  const splitTreeLists = []
  for (const treeList of treeLists) {
    const splitTrees = []
    let treeIndex = 0
    let partialTree
    for (let eventIndex = 1; eventIndex < events.length; eventIndex++) {
      const event = events[eventIndex]
      if (partialTree !== undefined) {
        if (partialTree.end === event) {
          splitTrees.push(partialTree)
          partialTree = undefined
          treeIndex++
        } else {
          // event < partialTree.end
          const [left, right] = splitRangeTree(partialTree, event)
          splitTrees.push(left)
          partialTree = right
        }
      } else {
        const tree = treeList[treeIndex]
        if (tree === undefined) {
          splitTrees.push(undefined)
        } else if (tree.end === event) {
          splitTrees.push(tree)
          treeIndex++
        } else if (tree.start < event) {
          // tree.start < event && event < tree.end
          const [left, right] = splitRangeTree(tree, event)
          splitTrees.push(left)
          partialTree = right
        } else {
          splitTrees.push(undefined)
        }
      }
    }
    splitTreeLists.push(splitTrees)
  }

  const result = []
  for (let eventIndex = 1; eventIndex < events.length; eventIndex++) {
    const splitTrees = []
    let parentAcc = 0
    for (const [i, splitTreeList] of splitTreeLists.entries()) {
      const splitTree = splitTreeList[eventIndex - 1]
      if (splitTree !== undefined) {
        splitTrees.push(splitTree)
      } else {
        parentAcc += parentCounts[i]
      }
    }
    const merged = mergeRangeTrees(splitTrees)
    if (merged !== undefined) {
      merged.count += parentAcc
      result.push(merged)
    }
  }
  return result
}

function hashFunction (fn) {
  return JSON.stringify([fn.ranges[0].startOffset, fn.ranges[0].endOffset])
}

function numSort (arr) {
  arr.sort((a, b) => a - b)
}
