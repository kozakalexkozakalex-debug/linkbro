import type { Locale, Messages } from "./config";
import { uk } from "@/messages/uk";
import { en } from "@/messages/en";
import { ru } from "@/messages/ru";
import { es } from "@/messages/es";

export const MESSAGES: Record<Locale, Messages> = { uk, en, ru, es };
