import React from "react";
import { isColorFormat } from "../utils/colorFormat";
import styles from "./TextRenderer.module.css";

const URL_PATTERN =
  /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i;

const isURL = (word: string) => {
  return URL_PATTERN.test(word);
};

const LinkifiedText = ({ text }: { text: string }) => {
  if (!isURL(text)) return <>{text}</>;

  const href = text.startsWith("http://") || text.startsWith("https://") ? text : `https://${text}`;

  return (
    <a
      className={styles.link}
      onClick={event => event.stopPropagation()}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </a>
  );
};

export const TextRenderer = ({ children }: React.PropsWithChildren) => {
  if (typeof children === "string" && isColorFormat(children)) {
    return (
      <span className={styles.row}>
        <span className={styles.colorPreview} style={{ backgroundColor: children }} />
        {children}
      </span>
    );
  }

  if (typeof children === "string") {
    return <LinkifiedText text={children} />;
  }

  return <>{`${children}`}</>;
};
