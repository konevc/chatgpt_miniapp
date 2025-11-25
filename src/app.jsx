// React types and functions
import React, { useEffect, useState } from "react";
import WaitingStatus from "./waiting_status.jsx";
// OpenAI types and functions
import { 
  useOpenAiGlobal,
  setOpenAIGlobal, 
  useWidgetState, 
  callTool,  
  sendMessage,  
  setDisplayMode,  
  openExternalURL
} from "./openai_utils";
import {
  SET_GLOBALS_EVENT_TYPE,
  SetGlobalsEvent,
  OpenAiGlobals,
  DeviceType,
  UserAgent,
  DisplayMode,
  RequestDisplayMode,
  CallToolResponse,
  CallTool,
  Theme
} from "./openai_types";


export default function App() {
  // Read actual display mode, max height, theme and device
  const displayMode = useOpenAiGlobal("displayMode");
  const rawMax = useOpenAiGlobal("maxHeight");
  const effectiveMax =
    typeof rawMax === "number" ? Math.max(0, rawMax - 40) : 480;
  const themeMode = useOpenAiGlobal("theme");
  const userAgent = useOpenAiGlobal("userAgent");
  const deviceType = userAgent.device;

  // Bind toolData to actual "toolOutput" data
  const toolData = useOpenAiGlobal("toolOutput");


  // Update "user_session_id" in the Widget State
  let user_session_id = null;
  if (toolData && typeof toolData === "object") {
    // Safely navigate nested "user_session_id"
    user_session_id = toolData?.user_session_id ?? null;
  }

  useEffect(() => {
    if (!user_session_id) return;

    const updateWidgetState = async () => {
      try {
        const currentWidgetState = window.openai?.["widgetState"] || {};

        // CRITICAL: Check if the value is already set to avoid the loop
        if (currentWidgetState.user_session_id === user_session_id) {
          return; 
        }

        const newState = {
          ...currentWidgetState,
          user_session_id,
        };

        await window.openai?.setWidgetState(newState);
      } catch (err) {
        console.error("❌ Failed to update widget state:", err);
      }
    };

    updateWidgetState();
  }, [user_session_id]); // Dependency array ensures this only runs when user_session_id changes
  

  // Prepare data based on device type and other parameters
  const isMobile = deviceType === "mobile";
  const baseHeight = isMobile ? 360 : 480;
  const containerHeight =
    displayMode === "fullscreen" ? effectiveMax : baseHeight;
  const containerMinHeightClass = isMobile
    ? "min-h-[360px]"
    : "min-h-[480px]";


  // Prepare data to display
  const externalUrl = toolData?.external_url;

  const pictureUrl = isMobile
    ? toolData?.mobile_picture_url
    : toolData?.picture_url;
  
  const pictureDimensionsClass = isMobile
    ? "w-[480px] h-[360px]"
    : "w-[640px] h-[480px]";

  const watchButtonVisible = Boolean(externalUrl);


  // Classes to display
  const watchButtonClass =
    "absolute bottom-4 right-6 px-5 py-3 rounded-full bg-green-600 text-white shadow-lg transition-transform duration-300 hover:scale-105 hover:bg-green-700 focus:outline-none focus:ring focus:ring-green-500/50 animate-pulse";
  const noContentIcon =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA2NCA2NCcgZmlsbD0nbm9uZSc+CiAgPGNpcmNsZSBjeD0nMjgnIGN5PScyOCcgcj0nMTYnIHN0cm9rZT0nIzRCNTU2Mycgc3Ryb2tlLXdpZHRoPSc0Jy8+CiAgPGxpbmUgeDE9JzM5JyB5MT0nMzknIHgyPSc1NCcgeTI9JzU0JyBzdHJva2U9JyM0QjU1NjMnIHN0cm9rZS13aWR0aD0nNCcgc3Ryb2tlLWxpbmVjYXA9J3JvdW5kJy8+CiAgPHBhdGggZD0nTTIwIDI4aDE2JyBzdHJva2U9JyM0QjU1NjMnIHN0cm9rZS13aWR0aD0nNCcgc3Ryb2tlLWxpbmVjYXA9J3JvdW5kJy8+Cjwvc3ZnPg==";


  // --- Click handler for Watch button ---
  const onWatchClick = async () => {
    if (!externalUrl) {
      return;
    }
    try {
      // 1) Open the external YouTube URL
      openExternalURL(externalUrl);

    } catch (err) {
      console.error("[MCP app] onWatchClick failed:", err);
    }
  };


  // Build React template to display
  return (
    <div
      /* Display a picture */
      style={{
        maxHeight: rawMax,
        height: containerHeight,
      }}
      className={
        "relative antialiased w-full overflow-hidden " +
        containerMinHeightClass +
        " " +
        (displayMode === "fullscreen"
          ? "rounded-none border-0"
          : "border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl")
      }
    >
      {/* Content is preparing */}
      {!toolData ? (
        <div className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-2 text-gray-500">
          <WaitingStatus />
        </div>
        /* No content found => display just one message */
      ) : (!pictureUrl || pictureUrl == "") ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-gray-600 dark:text-gray-300">
          <img src={noContentIcon} alt="No content" className="h-20 w-20" />
          <span className="text-lg font-semibold">No content found</span>
        </div>
      ) : (
        /* Display content */
        <div className="flex h-full w-full flex-col items-left justify-left p-4">
          {/* Display a picture */}
          {pictureUrl ? (
            <img
              src={pictureUrl}
              alt={"Preview"}
              title={"Picture Demo"}
              className={`rounded-xl object-cover shadow-md ${pictureDimensionsClass}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-500">
              Image unavailable
            </div>
          )}
          {/* Display call-to-action button */}
          {watchButtonVisible && (
            <button
              type="button"
              onClick={onWatchClick}
              className={watchButtonClass}
              aria-label="Watch on YouTube"
              title="Watch on YouTube"
            >
              Watch content
            </button>
          )}
        </div>
      )}
    </div>
  );
}