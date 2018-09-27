const {RangeTree} = require('./range-tree')

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
  const trees = []
  let isBlockCoverage = false
  for (const fn of fns) {
    const tree = RangeTree.fromRanges(fn.ranges)
    trees.push(tree)
    isBlockCoverage = isBlockCoverage || fn.isBlockCoverage
  }
  if (first.functionName === 'formatWithOptions') {
    console.log(RangeTree.toAsciiForest(trees))
    // process.exit(0)
  }
  const mergedTree = mergeRangeTrees(trees)
  mergedTree.normalize()
  const ranges = mergedTree.toRanges()
  return {
    functionName: first.functionName,
    ranges,
    isBlockCoverage,
  }
}

/**
 * @precondition Same `start` and `end` for all the trees
 */
function mergeRangeTrees (trees) {
  if (trees.length <= 1) {
    return trees[0]
  }
  const first = trees[0]
  let count = 0
  for (const tree of trees) {
    count += tree.count
  }
  const children = mergeRangeTreeChildren(trees)
  return new RangeTree(first.start, first.end, count, children)
}

function mergeRangeTreeChildren (parentTrees) {
  extendChildren(parentTrees)
  const events = getChildBoundaries(parentTrees)
  const splitTreeLists = []
  for (const parentTree of parentTrees) {
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
          const right = partialTree.split(event)
          splitTrees.push(partialTree)
          partialTree = right
        }
      } else {
        const tree = parentTree.children[treeIndex]
        if (tree === undefined) {
          splitTrees.push(undefined)
        } else if (tree.end === event) {
          splitTrees.push(tree)
          treeIndex++
        } else if (tree.start < event) {
          // tree.start < event && event < tree.end
          const right = tree.split(event)
          splitTrees.push(tree)
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
        parentAcc += parentTrees[i].count
      }
    }
    const merged = mergeRangeTrees(splitTrees)
    if (merged !== undefined) {
      merged.addCount(parentAcc)
      result.push(merged)
    }
  }
  return result
}

function getChildBoundaries (parentTrees) {
  const boundarySet = new Set()
  for (const parentTree of parentTrees) {
    for (const tree of parentTree.children) {
      boundarySet.add(tree.start)
      boundarySet.add(tree.end)
    }
  }
  const boundaries = [...boundarySet]
  numSort(boundaries)
  return boundaries
}

// To check:

// ######--##----------##---
// --##--------###---#####--

// ######------
// ####--------
// --##--------

// #######-----
// ##-##-##----

// -#######----
// ##-##-##----

// ####-####---
// ##-###-##---

// ####-
// ##---
// --###

// #######-
// ##------
// --###---

// #######--
// ###-###--
// -#---#---

// 0  1  2  3  4  5  6  7  8  9
// [-------------------------)
//
//    [----------------)
//
//       [----------)
// ->
// [-------------------------)
//
// [-------------------------)
//    [----------------)
//
// [-------------------------)
//    [----------------)
//       [----------)

// 0  1  2  3  4  5  6  7  8  9
// [-------------------------)
//
//    [-------)   [-------)
//
//    [-)   [-)   [-)   [-)
// ->
// [-------------------------)
//
//    [-------)   [-------)
//
//    [-------)   [-)   [-)
//    [-)   [-)
function extendChildren (parentTrees) {
  const events = getChildBoundaries(parentTrees)
  // const expectedEvents = []

  const openTrees = new Set()
  const remainingChildren = new Map(parentTrees.map(tree => [tree, [...tree.children].reverse()]))

  const inclusionTree = new Map()
  const inclusionRoots = new Set()
  const parents = new WeakMap()
  const newChildren = new Map(parentTrees.map(tree => [tree, new Set()]))

  for (const event of events) {
    const startChildren = []
    const endChildren = []
    const exhaustedParents = []
    for (const [parent, remaining] of remainingChildren) {
      let child = remaining[remaining.length - 1]
      if (child !== undefined && child.end === event) {
        remaining.pop()
        endChildren.push(child)
        child = remaining[remaining.length - 1]
      }
      if (child !== undefined && child.start === event) {
        startChildren.push(child)
        parents.set(child, parent)
      }
      if (child === undefined) {
        exhaustedParents.push(parent)
      }
    }
    for (const parent of exhaustedParents) {
      remainingChildren.delete(parent)
    }
    if (startChildren.length > 0) {
      const originalLength = startChildren.length
      for (let i = 0; i < originalLength; i++) {
        const startChild = startChildren[i]
        for (const openTree of openTrees) {
          if (startChild.start < openTree.end && openTree.end < startChild.end) {
            // Found:
            // openTree   [x---)
            // startChild    [y---)
            // Output:
            // openTree   [x---)
            // startChild    [y)[y) startRight
            const startRight = startChild.split(openTree.end)
            const startParent = parents.get(startChild)
            parents.set(startRight, startParent)
            const startRemaining = remainingChildren.get(startParent)
            startRemaining.pop()
            startRemaining.push(startRight)
            startRemaining.push(startChild)
            // TODO: Check is this break is safe
            break
          }
        }
      }
    }
    for (const endChild of endChildren) {
      let superTree
      for (const openTree of openTrees) {
        if (openTree.start < endChild.start && endChild.end <= openTree.end || openTree.start <= endChild.start && endChild.end < openTree.end) {
          superTree = openTree
          break
        }
      }
      if (superTree !== undefined) {
        let subChildren = inclusionTree.get(superTree)
        if (subChildren === undefined) {
          subChildren = []
          inclusionTree.set(superTree, subChildren)
        }
        subChildren.push(endChild)
        inclusionRoots.add(superTree)
        inclusionRoots.delete(endChild)
      }
      const endParent = parents.get(endChild)
      const newChildrenSet = newChildren.get(endParent)
      newChildrenSet.add(endChild)
    }
    for (const endChild of endChildren) {
      openTrees.delete(endChild)
    }
    for (const startChild of startChildren) {
      openTrees.add(startChild)
    }
  }
  for (const superTree of inclusionRoots) {
    // post-order sorted list of descendants (by inclusion)
    const descendants = []
    const stack = [superTree]
    while (stack.length > 0) {
      // The ordering of the stacks and iteration is important
      const cur = stack.pop()
      if (cur !== superTree) {
        descendants.unshift(cur)
      }
      const subTrees = inclusionTree.get(cur)
      if (subTrees !== undefined) {
        for (const subTree of subTrees) {
          stack.push(subTree)
        }
      }
    }
    const parentToWrapper = new Map()

    for (const subTree of descendants) {
      const parent = parents.get(subTree)
      const wrapper = parentToWrapper.get(parent)
      if (wrapper === undefined) {
        const nested = subTree.copy()
        Object.assign(
          subTree,
          {start: superTree.start, end: superTree.end, count: parent.count, children: [nested]},
        )
        parentToWrapper.set(parent, subTree)
      } else {
        wrapper.children.push(subTree)
        newChildren.get(parent).delete(subTree)
      }
    }
  }
  for (const parentTree of parentTrees) {
    parentTree.children = [...newChildren.get(parentTree)]
  }
}

function hashFunction (fn) {
  return JSON.stringify([fn.ranges[0].startOffset, fn.ranges[0].endOffset])
}

function numSort (arr) {
  arr.sort((a, b) => a - b)
}
