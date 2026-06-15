import {
  autoUpdate,
  flip,
  offset as floatingOffset,
  shift,
  size as floatingSize,
  useFloating,
  type VirtualElement,
} from "@floating-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createTextNode, type TextNode } from "lexical";
import type { AvailableVariableField, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import { $createVariableNode } from "./VariableNode";
import { useAvailableVariables } from "../WorkflowGraphContext";
import { workflowNodeIcons } from "../workflowNodes/workflowNodeVisuals";

class VariableMenuOption extends MenuOption {
  field: AvailableVariableField;
  nodeLabel: string;
  nodeType: WorkflowNodeType;

  constructor(field: AvailableVariableField, nodeLabel: string, nodeType: WorkflowNodeType) {
    super(field.reference);
    this.field = field;
    this.nodeLabel = nodeLabel;
    this.nodeType = nodeType;
  }
}

const MENU_WIDTH_PX = 288;
const MENU_MAX_HEIGHT_PX = 288;
const MENU_OFFSET_PX = 20;
const VIEWPORT_PADDING_PX = 12;

/** Matches a `/` (at start or after whitespace) plus the typed query after it. */
function checkForSlashTrigger(text: string): MenuTextMatch | null {
  const match = /(?:^|\s)\/([\p{L}\p{N}_.]*)$/u.exec(text);
  if (match === null) {
    return null;
  }
  const slashIndex = match.index + match[0].indexOf("/");
  const matchingString = match[1];
  return {
    leadOffset: slashIndex,
    matchingString,
    replaceableString: `/${matchingString}`,
  };
}

/**
 * Lexical typeahead: typing `/` in a variable-bearing field opens a grouped,
 * searchable list of the consumer node's Available Variables; choosing one
 * replaces the `/query` with an atomic Variable chip. Reuses `getAvailableVariables`
 * via the graph context so the list always matches the if/else picker.
 */
export function SlashVariablePlugin({ nodeId }: { nodeId: string }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const groups = useAvailableVariables(nodeId);

  const options = useMemo(() => {
    const needle = (query ?? "").toLowerCase();
    const flat: VariableMenuOption[] = [];
    for (const group of groups) {
      for (const field of group.fields) {
        if (!field.selectable) {
          continue;
        }
        const haystack = `${group.nodeLabel} ${field.path.join(".")}`.toLowerCase();
        if (needle && !haystack.includes(needle)) {
          continue;
        }
        flat.push(new VariableMenuOption(field, group.nodeLabel, group.nodeType));
      }
    }
    return flat;
  }, [groups, query]);

  const onSelectOption = useCallback(
    (selected: VariableMenuOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        const variableNode = $createVariableNode(selected.field.reference);
        if (nodeToReplace) {
          nodeToReplace.replace(variableNode);
        }
        const spacer = $createTextNode(" ");
        variableNode.insertAfter(spacer);
        spacer.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<VariableMenuOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={checkForSlashTrigger}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (anchorElementRef.current == null) {
          return null;
        }
        return (
          <SlashVariableMenuPopover
            anchorElement={anchorElementRef.current}
            options={options}
            query={query}
            selectedIndex={selectedIndex}
            selectOptionAndCleanUp={selectOptionAndCleanUp}
            setHighlightedIndex={setHighlightedIndex}
          />
        );
      }}
    />
  );
}

function SlashVariableMenuPopover({
  anchorElement,
  options,
  query,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
}: {
  anchorElement: HTMLElement;
  options: VariableMenuOption[];
  query: string | null;
  selectedIndex: number | null;
  selectOptionAndCleanUp: (option: VariableMenuOption) => void;
  setHighlightedIndex: (index: number) => void;
}) {
  const [availableMenuHeight, setAvailableMenuHeight] = useState(MENU_MAX_HEIGHT_PX);
  const virtualReference = useMemo<VirtualElement>(
    () => ({
      contextElement: anchorElement,
      getBoundingClientRect: () => anchorElement.getBoundingClientRect(),
    }),
    [anchorElement],
  );
  const { floatingStyles, refs, update } = useFloating({
    middleware: [
      floatingOffset(MENU_OFFSET_PX),
      flip({ padding: VIEWPORT_PADDING_PX }),
      shift({ padding: VIEWPORT_PADDING_PX }),
      floatingSize({
        padding: VIEWPORT_PADDING_PX,
        apply({ availableHeight }) {
          const nextHeight = Math.max(0, Math.min(MENU_MAX_HEIGHT_PX, Math.floor(availableHeight)));
          setAvailableMenuHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
        },
      }),
    ],
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setPositionReference(virtualReference);
  }, [refs, virtualReference]);

  useEffect(() => {
    void update();
  }, [options.length, query, update]);

  return createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, width: MENU_WIDTH_PX }}
      className="z-[100] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20"
    >
      <div style={{ maxHeight: availableMenuHeight }} className="overflow-y-auto py-1" role="listbox">
        {options.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {query ? "无匹配变量" : "没有可用的上游变量"}
          </p>
        ) : (
          options.map((option, index) => {
            const previous = options[index - 1];
            const showHeader = !previous || previous.nodeLabel !== option.nodeLabel;
            const NodeIcon = workflowNodeIcons[option.nodeType];
            const active = index === selectedIndex;
            return (
              <div key={option.key} ref={option.setRefElement}>
                {showHeader && (
                  <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <NodeIcon className="size-3" aria-hidden />
                    <span className="truncate">{option.nodeLabel}</span>
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={[
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left",
                    active ? "bg-muted" : "",
                  ].join(" ")}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    setHighlightedIndex(index);
                    selectOptionAndCleanUp(option);
                  }}
                >
                  <span className="shrink-0 font-mono text-[10px] font-semibold text-blue-500">{"{x}"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {option.field.path.join(".")}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{option.field.type}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>,
    anchorElement,
  );
}
