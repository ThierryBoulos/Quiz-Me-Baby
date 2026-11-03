"use client";
/* A game with no TV (3 Nov): the creator taps "Play without TV" in the TV's lobby, takes a seat on that phone, and
   that phone runs the game for everyone (the room page). Every phone then knows there's no TV: nothing says "Eyes on
   the TV", and a result isn't held back for a reveal nobody is watching. With a TV, nothing changes. */
import { createContext, useContext } from "react";

export const NoTv = createContext(false);
export const useNoTv = () => useContext(NoTv);
/* the room's flag (room.state.notv), set by the TV's lobby */
export const isNoTv = (state: unknown) => !!(state as { notv?: boolean } | null | undefined)?.notv;
