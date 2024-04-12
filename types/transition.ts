export type Transition = {
    event: string,
    next?: string,
    conditions?: {
        friendly_name: string
    }[]
};
