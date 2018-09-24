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
    trees.push(RangeTree.fromRanges(fn.ranges))
    isBlockCoverage = isBlockCoverage || fn.isBlockCoverage
  }
  const mergedTree = mergeRangeTrees(trees)
  const normalizedTree = normalizeRangeTree(mergedTree)
  const ranges = flattenRangeTree(normalizedTree)
  return {
    functionName: first.functionName,
    ranges,
    isBlockCoverage,
  }
}

function flattenRangeTree (tree) {
  return RangeTree.prototype.toRanges.apply(tree)
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
    children: mergeRangeTreeChildren(trees),
  }
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
          const [left, right] = splitRangeTree(partialTree, event)
          splitTrees.push(left)
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
        parentAcc += parentTrees[i].count
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

// ####------
// --#####---

// --####--
// #####---

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
  const nextChildIndexes = new Map(parentTrees.map(tree => [tree, 0]))
  const tmpChildren = new Map(parentTrees.map(tree => [tree, undefined]))

  const inclusionTree = new Map()
  const inclusionRoots = new Set()
  const parents = new WeakMap()
  const newChildren = new Map(parentTrees.map(tree => [tree, new Set()]))

  for (const event of events) {
    const startChildren = []
    const endChildren = []
    const exhaustedParents = []
    for (const [parent, nextChildIndex] of nextChildIndexes) {
      let child = tmpChildren.get(parent)
      if (child === undefined) {
        child = parent.children[nextChildIndex]
        if (child === undefined) {
          exhaustedParents.push(parent)
          continue
        }
      }
      if (child.end === event) {
        endChildren.push(child)
        nextChildIndexes.set(parent, nextChildIndex + 1)
      }
    }
    for (const parent of exhaustedParents) {
      nextChildIndexes.delete(parent)
    }
    exhaustedParents.length = 0
    for (const [parent, nextChildIndex] of nextChildIndexes) {
      let child = tmpChildren.get(parent)
      if (child === undefined) {
        child = parent.children[nextChildIndex]
        if (child === undefined) {
          exhaustedParents.push(parent)
          continue
        }
      }
      if (child.start === event) {
        startChildren.push(child)
        parents.set(child, parent)
      }
    }
    for (const parent of exhaustedParents) {
      nextChildIndexes.delete(parent)
    }
    if (startChildren.length > 0) {
      for (const openTree of openTrees) {
        const originalLength = startChildren.length
        for (let i = 0; i < originalLength; i++) {
          const startChild = startChildren[i]
          if (startChild.start < openTree.end && openTree.end < startChild.end) {
            // --#####--- openTree
            // ----#####- startChild
            const [openLeft, openRight] = splitRangeTree(openTree, startChild.start)
            const [startLeft, startRight] = splitRangeTree(startChild, startChild.start)
            const openParent = parents.get(openTree)
            const startParent = parents.get(startChild)
            Object.assign(startChild, startLeft)
            Object.assign(openTree, openLeft)
            parents.set(openRight, openParent)
            parents.set(startRight, startParent)
            endChildren.push(openTree)
            startChildren.push(openRight)
            tmpChildren.set(startParent, startRight)
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
      openTrees.delete(endChild)
      const endParent = parents.get(endChild)
      if (endParent === undefined) {
        console.log(endChild)
      }
      const newChildrenSet = newChildren.get(endParent)
      if (newChildrenSet === undefined) {
        console.log(endParent)
      }
      newChildrenSet.add(endChild)
    }
    for (const startChild of startChildren) {
      openTrees.add(startChild)
    }
  }
  for (const superTree of inclusionRoots) {
    const subTrees = inclusionTree.get(superTree)
    const wrappers = new Map()
    if (subTrees !== undefined) { // Always true
      for (const subTree of subTrees) {
        const parent = parents.get(subTree)
        const wrapper = wrappers.get(parent)
        if (wrapper === undefined) {
          const nested = {...subTree}
          Object.assign(
            subTree,
            {start: superTree.start, end: superTree.end, count: parent.count, children: [nested]},
          )
          wrappers.set(parent, subTree)
        } else {
          for (const child of subTree.children) {
            wrapper.children.push(child)
          }
          newChildren.get(parent).delete(subTree)
        }
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

// OK:
// [1      ]
//      [2     ]
// ->
// [1  ][3 ][2 ]
//
// Not OK:
// [1            ]
//      [2  ]
// ->
// [1  ][3  ][1  ]
//
// OK:
// [1            ]
//      [2  ]
// ->
// [1   [3 ]   ]
//
