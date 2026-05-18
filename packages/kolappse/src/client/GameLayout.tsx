import { Group, Panel, Separator } from "react-resizable-panels";

import styles from "./GameLayout.module.css";

export function GameLayout() {
  return (
    <Group
      orientation="horizontal"
      className={styles.root}
      defaultLayout={{ charpane: 15, middle: 63, chatpane: 22 }}
    >
      <Panel id="charpane" minSize={5}>
        <iframe name="charpane" src="charpane.php" className={styles.frame} />
      </Panel>

      <Separator className={styles.vHandle} />

      <Panel id="middle" minSize={20}>
        <Group
          orientation="vertical"
          style={{ height: "100%" }}
          defaultLayout={{ menupane: 7, mainpane: 93 }}
        >
          <Panel id="menupane" minSize={3}>
            <iframe
              name="menupane"
              src="topmenu.php"
              className={styles.frame}
              scrolling="no"
            />
          </Panel>

          <Separator className={styles.hHandle} />

          <Panel id="mainpane" minSize={20}>
            <iframe name="mainpane" src="main.php" className={styles.frame} />
          </Panel>
        </Group>
      </Panel>

      <Separator className={styles.vHandle} />

      <Panel id="chatpane" minSize={5}>
        <iframe name="chatpane" src="chatlaunch.php" className={styles.frame} />
      </Panel>
    </Group>
  );
}
