import React from "react";
import styled from "styled-components";
import { getToDiagramEditorUrl, openInToDiagram } from "../../../../lib/utils/todiagramHandoff";
import useFile from "../../../../store/useFile";

const BUTTON_IMAGE = "/assets/open-in-todiagram.svg";

const StyledLink = styled.a`
  position: absolute;
  bottom: 14px;
  left: 14px;
  z-index: 3;
  display: block;
  line-height: 0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
  }

  img {
    display: block;
    height: 39px;
    width: auto;
  }
`;

export const OpenInToDiagram = () => {
  const format = useFile(state => state.format);
  const href = getToDiagramEditorUrl({ medium: "open_button", format });

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const opened = openInToDiagram({
      url: href,
      content: useFile.getState().getContents(),
      format,
    });

    // Popup blocked: let the anchor navigate normally.
    if (opened) event.preventDefault();
  };

  return (
    <StyledLink href={href} target="_blank" onClick={handleClick} title="Open in ToDiagram">
      <img src={BUTTON_IMAGE} alt="Open in ToDiagram" width={184} height={39} loading="lazy" />
    </StyledLink>
  );
};
