import type {Flow} from "./types/flow.ts";
import {u} from "unist-builder";
import {SKIP, visitParents} from "unist-util-visit-parents";
import type {TwilioNode} from "./types/twilioNode.ts";

const [, , flowJsonPath] = Bun.argv

const file = Bun.file(flowJsonPath);

const flow: Flow = await file.json();

const verticalSpace = 250;
const defaultStateWidth = 250;
const horizontalSpaceBetweenNodes = 250;

const numberOfCharactersInEventTextToSplitOn = 25;

const allStates = new Map<string, TwilioNode>();

// Create a node for each state
flow.states.forEach((state) => {
    let width = defaultStateWidth;

    if (state.type === 'split-based-on') {
        const totalNumberOfCharactersInFriendlyNameText = state.transitions.reduce(
            (accumulator, transition) => {
                let characters = 0

                if (transition.conditions) {
                    characters = transition.conditions.reduce(
                        (accumulator, condition) => accumulator + condition.friendly_name.length,
                        0
                    )
                }

                return accumulator + characters;
            },
            0,
        );

        width = Math.max(
            1,
            Math.round(totalNumberOfCharactersInFriendlyNameText / numberOfCharactersInEventTextToSplitOn)
        ) * defaultStateWidth
    }

    allStates.set(state.name, u(state.type, {
        name: state.name,
        width: width,
    }, []));
});

// Connect each node in the tree
flow.states.forEach((state) => {
    const from = allStates.get(state.name)

    from.children = state.transitions
        .map((transition) => transition.next ? allStates.get(transition.next) : null)
        .filter((item): item is TwilioNode => !!item)
});

const nodeLevelByNodeNamesSeen = new Map<number, Set<string>>();

visitParents(allStates.get('Trigger'), function (node: TwilioNode, ancestors) {
    // Prevent infinite loop
    if (ancestors.includes(node)) {
        return SKIP;
    }

    const parentLevel = ancestors.length;
    const currentLevel = parentLevel + 1;

    if (!nodeLevelByNodeNamesSeen.has(currentLevel)) {
        nodeLevelByNodeNamesSeen.set(currentLevel, new Set<string>())
    }

    const seenNodes = nodeLevelByNodeNamesSeen.get(currentLevel);
    seenNodes.add(node.name)
})

let cumulativeX = 0

for (const [nodeLevel, nodeNames] of nodeLevelByNodeNamesSeen) {
    for (const nodeName of nodeNames) {
        const node = allStates.get(nodeName)

        if (node.position === undefined) {
            node.position = {
                start: {line: verticalSpace * (nodeLevel - 1), column: cumulativeX},
                end: {line: 0, column: 0}
            }

            cumulativeX += node.width + horizontalSpaceBetweenNodes
        }
    }

    cumulativeX = 0
}

const newStates = flow.states.map((state) => {
    const node = allStates.get(state.name)

    state.properties.offset.x = node.position?.start.column ?? 0
    state.properties.offset.y = node.position?.start.line ?? 0

    return state
})

flow.states = newStates

await Bun.write('./output.json', JSON.stringify(flow));

for (const twilioNode of allStates.values()) {
    console.log(twilioNode.name, twilioNode.position?.start)
}

console.log('Done!')
