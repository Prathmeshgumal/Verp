/**
 * Links and images are never dragged here. A fast click that slips a few pixels starts a native drag,
 * and on Linux (Wayland) Chrome can get stuck in it, ignoring every click until the page is reloaded.
 */
export function blockLinkDrags(target: Document = document): () => void {
  const onDragStart = (event: DragEvent) => {
    if (event.target instanceof Element && event.target.closest('a, img')) event.preventDefault();
  };
  target.addEventListener('dragstart', onDragStart);
  return () => target.removeEventListener('dragstart', onDragStart);
}
