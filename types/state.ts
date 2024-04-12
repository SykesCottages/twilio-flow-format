import type {TwilioStateType} from "./twilioStateType.ts";
import type {Transition} from "./transition.ts";

export type State = {
    name: string,
    type: TwilioStateType,
    transitions: Transition[],
    properties: { offset: { x: number, y: number } }
};
