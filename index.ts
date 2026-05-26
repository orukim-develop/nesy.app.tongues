import { readSettings } from "./lib/settings";
import { handleOnboard } from "./handlers/onboard";
import { handleCheckText, handleSaveCorrection } from "./handlers/check";
import { handleDefend } from "./handlers/defend";
import { handleAddCard, handleListCards } from "./handlers/cards";
import { handleGetReviewQueue, handleGradeCard } from "./handlers/review";
import { handleRenderBoard } from "./handlers/board";

export type RunInput = {
  input: { tool: string; args: Record<string, any> };
  secrets: Record<string, string>;
  data: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<boolean>;
    list(
      prefix?: string,
      limit?: number
    ): Promise<{ key: string; value: any; updated_at: string }[]>;
  };
};

export async function run({ input, data }: RunInput): Promise<unknown> {
  const settings = await readSettings(data);

  switch (input.tool) {
    case "onboard":
      return handleOnboard(input.args, data, settings);
    case "check_text":
      return handleCheckText(input.args, data, settings);
    case "save_correction":
      return handleSaveCorrection(input.args, data, settings);
    case "defend":
      return handleDefend(input.args, data, settings);
    case "add_card":
      return handleAddCard(input.args, data, settings);
    case "list_cards":
      return handleListCards(input.args, data, settings);
    case "get_review_queue":
      return handleGetReviewQueue(input.args, data, settings);
    case "grade_card":
      return handleGradeCard(input.args, data, settings);
    case "render_board":
      return handleRenderBoard(input.args, data, settings);
    default:
      throw new Error(`Unknown tool: ${input.tool}`);
  }
}
