import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { foodmeApi } from "@/api/foodme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRatingInput } from "@/components/sections/star-rating";
import type { FullOrderDto } from "@/types";

const MAX_COMMENT = 1000;

/**
 * "Rate order" window (R16-R18): 5 stars + optional comment. On success it closes and
 * refreshes everything that shows the order or the chef's rating (R12, R17, R19).
 */
export function RateOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Pick<FullOrderDto, "number" | "chefId" | "chefName">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      foodmeApi.reviewMyOrder(order.number, {
        rating,
        comment: comment.trim() ? comment.trim() : undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", order.number], updated);
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", order.number] });
      // The chef's average changed: storefront cards and the chef page must refetch.
      void queryClient.invalidateQueries({ queryKey: ["chef", order.chefId] });
      void queryClient.invalidateQueries({ queryKey: ["chef", String(order.chefId)] });
      void queryClient.invalidateQueries({ queryKey: ["chefs"] });
      onOpenChange(false);
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) {
      setRating(0);
      setComment("");
      mutation.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rod_root max-w-md" aria-describedby={undefined}>
        <form
          aria-label="Rate order"
          className="p-5 md:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating >= 1) mutation.mutate();
          }}
        >
          <DialogTitle className="pr-10 font-display text-xl font-bold text-zinc-900">
            Rate order {order.number}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-zinc-500">
            How was your food from {order.chefName}?
          </DialogDescription>

          <div className="mt-5">
            <StarRatingInput
              value={rating}
              onChange={setRating}
              disabled={mutation.isPending}
              label="Your rating"
            />
          </div>

          <label htmlFor="rod-comment" className="sr-only">
            Comment (optional)
          </label>
          <textarea
            id="rod-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={MAX_COMMENT}
            rows={4}
            disabled={mutation.isPending}
            placeholder="Tell us about your order"
            className="mt-4 w-full resize-none rounded-xl border border-zinc-200 px-3.5 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 md:text-sm"
          />
          <p className="mt-1 text-right text-xs tabular-nums text-zinc-400" aria-live="polite">
            {comment.length}/{MAX_COMMENT}
          </p>

          {mutation.isError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {mutation.error.message}
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={mutation.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={rating < 1 || mutation.isPending}>
              {mutation.isPending ? "Submitting…" : mutation.isError ? "Try again" : "Submit rating"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
