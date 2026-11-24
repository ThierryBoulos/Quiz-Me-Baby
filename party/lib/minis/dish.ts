/* Guess the Cocktail or Dish: one copy of its words for every setup (24 Nov, the owner's answers). Apart on purpose:
   with 2 teams a buzzer (the first captain to buzz answers, the first right takes the recipe); with 3 to 8 every
   captain has one guess, the faster right the more points. The screens are in components/DishGame.tsx. */
import { DISH_STEP } from "../game";

export const DISH = {
  title: "Guess the Cocktail or Dish",
  unit: "recipe",
  setupLine: (secs?: number) => `Five recipes, a new ingredient every ${secs ?? DISH_STEP} seconds: which cocktail or dish?`,
  rule1: (secs?: number) => `The ingredients come up one at a time, a new one every ${secs ?? DISH_STEP} seconds. Captains have one guess to name the cocktail or dish.`,
  /* 2 teams' rules: the buzzer, then the short form (as Flag's) */
  rulesTwo: (typeSecs: number, n: number, pts: string) => [`Know it? Captain, hit BUZZ: the first buzz answers, and has ${typeSecs} seconds to type it.`,
    "The fastest right guess takes it: +1. Wrong, and you're out of that one. Nobody? Nobody.", `Best of ${n} takes ${pts}. Tied? One more recipe, or a point each.`],
  topCaptain: "Know it? One guess for your team.",
  topCaptainTwo: "Know it? BUZZ! One guess for your team.",
  topPlayer: "Guess the Cocktail or Dish: help your captain",
  boxLine: (many: boolean) => `One guess for your team: a wrong one puts you out of this recipe.${many ? " The faster your right answer, the more points." : ""}`,
  change: "Change recipe",
};
