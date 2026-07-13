import styles from './AuthoringE2ECard.module.css'

export function AuthoringE2EPage() {
  return (
    <main>
      <section className={styles.card} data-name="Extract this card">
        Extract this card
      </section>
      <section className={styles.card} data-name="Extract canonical CSS card">
        Extract canonical CSS card
      </section>
    </main>
  )
}

export default AuthoringE2EPage
